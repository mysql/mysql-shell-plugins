# Copyright (c) 2025, Oracle and/or its affiliates.
#
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

# Define plugin version

from msm_plugin import lib
import json
import os
from pathlib import Path
import re
import shutil
from string import Template
from datetime import date
from textwrap import indent
import mysqlsh


MSM_SCRIPT_HEADER_LINE = "-- ###############################################" \
    "##############################\n"

# Regex to match MSM sections, excluding the license and the last section
MSM_SECTIONS_REGEX = r'--\s+MSM\s+Section\s+(\d+):\s*(.*?)$\s+(.*?)(--\s+#+)'

# Regex to match the last MSM sections below the second to last section
MSM_LAST_SECTION_REGEX = r'--\s+MSM\s+Section\s+(\d+):\s*(.*?)$\s+(.*)'

# Regex to match the MSM LOOP UPDATABLE-VERSIONS
MSM_LOOP_UPDATABLE_VERSIONS_REGEX = \
    r'--\s+###\s+MSM-LOOP-START:UPDATABLE-VERSIONS(\(indent=(\d+)\))?.*?\n(.*?)' \
    r'--\s+###\s+MSM-LOOP-END:UPDATABLE-VERSIONS.*?\n'

# Reges to match the MSM section placeholder
MSM_SECTION_PLACEHOLDER_REGEX = r'\$\{section_(\d+).*?\}\n'

# Regex to match the leading comments and empty lines before SQL commands,
# but ensure that comments before SQL commands are kept
REMOVE_LEADING_COMMENTS_AND_EMPTY_LINES = r'((^--.*?\n)+(^\s*\n)+)'

# Regex to match all empty lines, including whitespace, at the end of the file
REMOVE_TRAILING_EMPTY_LINES = r'(\s*\Z)'

MSM_SCHEMA_VERSION_VIEW_VALUES = r'CREATE.*?VIEW.*?`msm_schema_version`.*?' \
    r'\(.*?`major`.*?`minor`.*?`patch`.*?\).*?AS.*?SELECT.*?' \
    r'((\d+).*?,.*?(\d+).*?,.*?(\d+))'

MSM_SECTION_SOURCE_REGEX = \
    r'^SOURCE\s+[\'"](.*?)[\'"]\s*\[(\d*:-?\d*)\]\s*;.*?$\n'

MSM_SECTION_REMOVE_COMMENTS_AND_DELIMITERS = \
    r'(^\s*--\s+.*?$)|(^DELIMITER\s+.*?$)|(\/\*.*?\*\/)'


def remove_leading_comments_trailing_lines(section: str) -> str:
    """Removes leading comments and empty lines at the beginning and end from the given section

    Args:
        section (str): The section to remove the leading comments from

    Returns:
        The trimmed section text
    """
    lines = section.splitlines()

    # Remove leading comments and empty lines
    while len(lines) > 0 and (lines[0].startswith("-- ") or lines[0].strip() == ""):
        lines = lines[1:]

    # Remove trailing empty lines
    while len(lines) > 0 and lines[len(lines) - 1].strip() == "":
        lines = lines[:len(lines) - 1]

    return "\n".join(lines)


def get_sql_content(full_section_content: str) -> tuple[str, int, int]:
    """Returns the sql content of a MSM section

    Args:
        full_section_content: The full content of the section

    Returns:
        The sql content as well as the start and the end position
    """
    # Search start position of sql content
    start_position = 0
    match = re.search(
        REMOVE_LEADING_COMMENTS_AND_EMPTY_LINES, full_section_content,
        re.MULTILINE | re.DOTALL)
    if match is not None:
        start_position = match.end()

    # Search end position of sql content
    end_position = len(full_section_content)
    match = re.search(
        REMOVE_TRAILING_EMPTY_LINES, full_section_content,
        re.MULTILINE | re.DOTALL)
    if match is not None:
        end_position = match.start()

    return (
        full_section_content[start_position:end_position],
        start_position,
        end_position)


def set_sql_content(section: dict, sql_content: str) -> None:
    """Sets the sql content of a MSM section

    Args:
        section: The MSM section as dict

    Returns:
        None
    """
    if not ("sql_content" in section and "sql_start" in section
            and "sql_end" in section):
        raise ValueError("The given section does not contain SQL content.")

    section["full_content"] = (
        section["full_content"][:section["sql_start"]] + sql_content)
    section["sql_content"] = sql_content
    section["sql_end"] = len(section["full_content"])


def get_script_sections(script: str) -> dict[str, dict]:
    """Returns the MSM sections of a script

    Args:
        script (str): The script as string

    Returns:
        A list of script dicts.
    """

    # Search for SCHEMA_DECORATOR
    matches = re.finditer(
        MSM_SECTIONS_REGEX, script, re.MULTILINE | re.DOTALL)

    # for match_id, match in enumerate(matches, start=1):
    #     print("Match {match_id} was found at {start}-{end}: {match}".format(
    #         match_id=match_id, start=match.start(), end=match.end(), match=match.group()))
    #     for group_id in range(0, len(match.groups())):
    #         group_id = group_id + 1
    #         print("Group {group_id} found at {start}-{end}: {group}".format(group_id=group_id,
    #               start=match.start(group_id), end=match.end(group_id), group=match.group(group_id)))

    sections = {}
    last_match_end = 0
    for match_id, match in enumerate(matches, start=1):
        if match_id == 1 and match.start() > 0:
            license_end_pos = match.start() - 1 - len(MSM_SCRIPT_HEADER_LINE)
            sections["license"] = {
                "full_content": script[:license_end_pos],
                "sql_content": "",
                "start_position": 0,
                "end_position": license_end_pos,
            }

        section_id = match.group(1)
        # Add back the section header line that is not matched by the regex
        full_content = (
            MSM_SCRIPT_HEADER_LINE
            + match.group()[:match.start(4) - match.start()]).strip() + "\n"
        sql_content, sql_start, sql_end = get_sql_content(full_content)

        sections[section_id] = {
            "full_content": full_content,
            "sql_content": sql_content,
            "sql_start": sql_start,
            "sql_end": sql_end,
            "start_position": match.start() - len(MSM_SCRIPT_HEADER_LINE),
            "end_position": match.end(),
        }
        last_match_end = match.end()

    matches = re.finditer(
        MSM_LAST_SECTION_REGEX, script[last_match_end + 1:], re.MULTILINE | re.DOTALL)
    for match in matches:
        section_id = match.group(1)
        sql_content, sql_start, sql_end = get_sql_content(match.group(3))
        sections[section_id] = {
            "full_content": MSM_SCRIPT_HEADER_LINE + match.group(),
            "sql_content": sql_content,
            "sql_start": sql_start,
            "sql_end": sql_end,
            "start_position": match.start(),
            "end_position": match.end(),
        }

    return sections


def get_file_sections(file_path: str) -> str:
    """Returns the MSM sections of a given file

    Args:
        file_path (str): The path of the SQL file.
        section_id (str): The id of the section.

    Returns:
        The SQL content as string
    """
    if not os.path.exists(file_path):
        raise ValueError(
            f"The file `{file_path}` could not be found.")

    with open(file_path, "r") as f:
        script = f.read()

    return get_script_sections(script)


def get_file_section(file_path: str, section_id: str) -> str:
    """Returns the SQL content of a MSM section of a given file

    Args:
        file_path (str): The path of the SQL file.
        section_id (str): The id of the section.

    Returns:
        The SQL content as string
    """
    sections = get_file_sections(file_path)

    if section_id in sections:
        return sections[section_id]
    else:
        raise ValueError(
            f"The MSM section `{section_id}` could not be found in the file `{file_path}`.")


def set_section_sql_content(
        section_id: str, sql_content: str, file_path: str = None,
        sections: dict[str, dict] = None) -> None:
    """Sets the SQL content of a MSM section of a file

    Args:
        section_id: The id of the section.
        sql_content: The sql content to set
        file_path: The path of the SQL file.
        sections: The MSM sections.

    Returns:
        None
    """
    if sections is None and file_path is not None:
        sections = get_file_sections(file_path)
    elif sections is None:
        raise ValueError("Either a file_path or sections must be set.")

    if not section_id in sections:
        raise ValueError(f"The given section `{section_id}` was not found.")

    section = sections[section_id]
    set_sql_content(section=section, sql_content=sql_content)

    if file_path is not None:
        write_sections_to_file(
            file_path=file_path, sections=sections, overwrite_existing=True)


def write_sections_to_file(file_path: str, sections: dict[str, dict], overwrite_existing: bool = False):
    """Writes all MSM sections to a file

    Args:
        file_path: The path write the sections to.
        sections: The MSM sections to write out.
        overwrite_existing: Whether an existing file should be replaced. Defaults to False.

    Returns:
        None
    """
    if os.path.exists(file_path) and not overwrite_existing:
        raise ValueError(
            f"The file {file_path} already exists. Please explicitly allow to replace existing files.")

    with open(file_path, "w") as f:
        f.write("\n".join(
            sections[section_id].get("full_content")
            for section_id in sections))


def convert_string_to_valid_filename(name: str) -> str:
    """Converts a string to a valid filename

    Replaces all spaces with underscores and remove characters that are not allowed.

    Args:
        name: The string to convert

    Returns:
        The converted filename
    """
    # Replace all spaces with underscores
    r = re.compile(r"\s+", re.MULTILINE)
    file_name = r.sub("_", name)

    # Remove characters that are not allowed
    r = re.compile(r"[\\\\/:*?\"<>|]", re.MULTILINE)
    file_name = r.sub("", file_name)

    return file_name


def check_mysql_identifier(identifier: str, must_be_usable_when_unquoted: bool = True):
    """Checks if the given identifier is valid

    Args:
        identifier: The identifier to be checked
        allow_special_chars: Wether

    Returns:
        The converted filename
    """
    if not must_be_usable_when_unquoted:
        if not re.match(r"^[A-Za-z0-9_]+[A-Za-z0-9_$]*$", identifier):
            raise ValueError(
                "Only basic Latin letters, digits 0-9, dollar, underscore are allowed to be used as schema name. "
                "Use the allow_special_chars option to overwrite this behavior.")
        if re.match(r"^[0-9]+$", identifier):
            raise ValueError(
                "A schema name must not consist solely of digits. "
                "Use the allow_special_chars option to overwrite this behavior.")


def get_license_text(schema_project_path: str = None, project_settings: dict = None) -> str:
    """Gets the correct license text for the given project

    The license text is fetch from the right license template and the variables are
    substituted accordingly.

    Args:
        schema_project_path: The MSM project path
        project_settings: Optional project settings

    Returns:
        The converted filename
    """
    if project_settings is None and schema_project_path is not None:
        project_settings = get_project_settings(schema_project_path)
    elif project_settings is None and schema_project_path is None:
        raise ValueError(
            "No schema_project_path nor project_settings parameter given.")

    try:
        copyright_holder = project_settings.get("copyrightHolder")
        license = project_settings.get("license")
        custom_license = project_settings.get("customLicense")
        year_of_creation = project_settings.get("yearOfCreation")
    except Exception as e:
        raise ValueError(
            f"The project settings must include copyrightHolder, license, customLicense and yearOfCreation. {e}")

    license_template = None
    if license.upper() == "CUSTOM":
        if custom_license is not None and custom_license != "":
            license_template = Template(custom_license)
        else:
            raise ValueError("No custom license text specified.")
    else:
        template_folder = os.path.join(
            Path(__file__).parent.parent, "templates")
        license_file_path = os.path.join(
            template_folder, "license", f"{license}.txt")
        if not os.path.exists(license_file_path):
            raise ValueError(
                f"No license stored under the given license name `{license}`. Please use a custom license text.")
        with open(license_file_path) as f:
            license_template = Template("".join(f.readlines()[1:]))

    current_year = date.today().strftime("%Y")
    try:
        license_text = license_template.substitute({
            "copyright_holder": copyright_holder,
            "year": year_of_creation if year_of_creation == current_year else f"{year_of_creation}, {current_year}"
        })
    except:
        raise ValueError(
            "The license template is either missing the ${year} or ${copyright_holder} placeholders.")

    return license_text


def copy_template_file_and_substitute(
        source_file_path: str, target_file_path: str, substitutions: dict):
    """Copies a template file and substitutes the given variables

    Args:
        source_file_path: The path to the source file
        target_file_path: The path to the target file
        substitutions: The dict holding the substitutions

    Returns:
        None
    """
    # Create schema development script
    with open(source_file_path, "r") as f:
        # Remove copyright line and replace placeholders
        script = Template("".join(f.readlines()[1:]))
        script = script.substitute(substitutions)

    with open(target_file_path, "w") as f:
        f.write(script)


def create_schema_project_folder(
        schema_name: str, target_path: str, copyright_holder: str, license: str = None,
        overwrite_existing: bool = False, allow_special_chars: bool = False,
        enforce_target_path: bool = False) -> str:
    """Creates a new schema project folder.

    Args:
        schema_name (str): The name of the schema.
        target_path (str): The path to the schema project folder.
        copyright_holder (str): The name of the copyright holder.
        license (str): The license to use for the project.
        overwrite_existing (bool): If the project folder already exists, overwrite it.
        allow_special_chars (bool): If set to True, allows all characters
        overwrite_existing (bool): If the project folder already exists, overwrite it.
        enforce_target_path (bool): If set to true, the target_path is created if it does not yet exist.

    Returns:
        The path of the project folder that was created.
    """

    check_mysql_identifier(
        identifier=schema_name,
        must_be_usable_when_unquoted=not allow_special_chars)

    target_path = os.path.abspath(os.path.expanduser(target_path))
    if not os.path.exists(target_path):
        if enforce_target_path:
            Path(target_path).mkdir(parents=True, exist_ok=True)
        else:
            raise ValueError(
                f'The project folder cannot be created inside the directory `{target_path}` as this path '
                'does not exist.')

    # When used in file names, critical characters need to be removed
    schema_file_name = convert_string_to_valid_filename(schema_name)

    # Create the project folder
    project_path = os.path.join(target_path, f"{schema_file_name}.msm.project")
    if os.path.exists(project_path):
        if overwrite_existing:
            shutil.rmtree(project_path)
        else:
            raise ValueError(
                f'The project folder "{project_path}" already exists.')

    os.makedirs(os.path.join(project_path), exist_ok=True)

    # Copy the template project file structure
    template_folder = os.path.join(Path(__file__).parent.parent, "templates")
    shutil.copytree(
        Path(os.path.join(template_folder, "msm.project")),
        project_path,
        dirs_exist_ok=True)

    # Get current year
    year_of_creation = date.today().strftime("%Y")

    project_settings = {
        "copyrightHolder": copyright_holder,
        "customLicense": "",
        "license": license,
        "schemaDependencies": [],
        "schemaName": schema_name,
        "schemaFileName": schema_file_name,
        "yearOfCreation": year_of_creation,
    }

    # Write the msm.project.json file
    with open(os.path.join(project_path, "msm.project.json"), "w") as f:
        f.write(json.dumps(project_settings, indent=4))

    # Replace placeholders in all markdown files
    files = list(Path(project_path).rglob("*.md"))
    for file in files:
        with open(file, "r") as f:
            script = Template(f.read())
            script = script.substitute({
                "schema_name": schema_name,
            })

        r = re.compile(r"Copyright.*$", re.MULTILINE)
        script = r.sub(
            f"Copyright (c) {year_of_creation}, {copyright_holder}.", script)

        with open(file, "w") as f:
            f.write(script)

    copy_template_file_and_substitute(
        source_file_path=os.path.join(
            template_folder, "scripts", "schema_next.sql"),
        target_file_path=os.path.join(
            project_path, "development", f"{schema_file_name}_next.sql"),
        substitutions={
            "license": get_license_text(project_settings=project_settings),
            "schema_name": schema_name,
            "version_str": "0.0.1",
            "version_comma_str": "0, 0, 1",
        })

    return project_path


def get_schema_development_file_path(schema_project_path: str = None) -> str:
    schema_file_name = get_project_settings(
        schema_project_path).get("schemaFileName", None)
    if schema_file_name is None:
        raise ValueError(
            f"The settings files of the project `{schema_project_path}` does not contain "
            "a schemaFileName value.")

    schema_dev_file_path = os.path.join(
        schema_project_path, "development", f"{schema_file_name}_next.sql")
    if not os.path.exists(schema_dev_file_path):
        raise ValueError(
            f"The MSM project folder does not contain a schema development file `{schema_dev_file_path}`.")

    return schema_dev_file_path


def get_schema_development_sections(schema_project_path: str = None) -> dict[str, dict]:
    schema_dev_file_path = get_schema_development_file_path(
        schema_project_path)

    with open(schema_dev_file_path, "r") as f:
        script = f.read()

    return get_script_sections(script)


def write_schema_development_file(schema_project_path: str, sections: dict[str, dict]) -> None:
    schema_dev_file_path = get_schema_development_file_path(
        schema_project_path)
    write_sections_to_file(
        file_path=schema_dev_file_path,
        sections=sections,
        overwrite_existing=True)


def schema_development_version(
        schema_project_path: str = None, sections: dict[str, dict] = None, new_version: str = None,
        write_to_file: bool = False) -> str:
    """Returns the development version of the current schema

    Args:
        schema_project_path: The path to the schema project folder.
        sections: The list of sections of the schema development file.
        new_version: If not None, the given version is set as new development version.
        write_to_file: Whether the development file should be updated. Defaults to False.

    Returns:
        A dict with information about the project
    """
    if sections is None and schema_project_path is None:
        raise ValueError(
            "No sections nor schema_project_path parameters given.")

    if sections is None:
        sections = get_schema_development_sections(
            schema_project_path=schema_project_path)

    # Process MSM Section 910: Database Schema Version
    version_section = sections.get("910", None)
    if version_section is None:
        for section_id in sections:
            section = sections[section_id]
            print(
                f"{section_id=}\n{section['full_content']=}\n\n{section['sql_content']=}\n\n\n")
        raise ValueError(
            "The script section `MSM Section 910: Database Schema Version` could not be found.")

    section_content = version_section.get("full_content")
    version_values = re.search(
        MSM_SCHEMA_VERSION_VIEW_VALUES, section_content, re.MULTILINE | re.DOTALL)
    if version_values is None:
        raise ValueError(
            "The script section `MSM Section 910: Database Schema Version` does not include the "
            "CREATE VIEW statement to create the `msm_schema_version` VIEW.")

    # If no new_version is given, return the current one
    if new_version is None:
        return f"{version_values.group(2)}.{version_values.group(3)}.{version_values.group(4)}"

    new_version_list = lib.core.convert_version_str_to_list(new_version)

    # Update the version
    updated_content = (
        section_content[:version_values.start(1)]
        + ", ".join(str(number) for number in new_version_list)
        + section_content[version_values.end(1):])

    version_section["full_content"] = updated_content

    sections["910"] = version_section

    if write_to_file:
        write_schema_development_file(
            schema_project_path=schema_project_path,
            sections=sections)

    return new_version


def get_schema_development_version(schema_project_path: str = None, sections: dict[str, dict] = None) -> str:
    """Returns the development version of the current schema

    Args:
        schema_project_path: The path to the schema project folder.
        sections: The list of sections of the schema development file.

    Returns:
        A dict with information about the project
    """
    return schema_development_version(
        schema_project_path=schema_project_path, sections=sections)


def set_development_version(
        new_version: str, schema_project_path: str = None, sections: dict = None, write_to_file: bool = False) -> dict:
    """Sets the development version inside the development/schema_next.sql file

    Args:
        version: The new version to create.
        schema_project_path: The path to the schema project folder.
        sections: The list of sections of the schema development file.
        write_to_file: Whether the development file should be updated. Defaults to False.

    Returns:
        None
    """
    return schema_development_version(
        schema_project_path=schema_project_path, sections=sections,
        new_version=new_version, write_to_file=write_to_file)


def get_project_settings(schema_project_path: str) -> dict:
    """Returns the project settings

    Args:
        schema_project_path: The path to the schema project folder.

    Returns:
        A dict with the project settings
    """
    if schema_project_path is None:
        raise ValueError("No schema_project_path given.")

    project_settings_file = os.path.join(
        schema_project_path, "msm.project.json")
    if not os.path.exists(project_settings_file):
        raise ValueError(
            f"The path {schema_project_path} does not contain a MSM project folder.")

    with open(project_settings_file, "r") as f:
        try:
            project_settings = json.loads(f.read())
        except:
            raise ValueError(
                f"The contents of the MSM project settings file `{project_settings_file}` is corrupted.")

    return project_settings


def get_released_versions(schema_project_path: str) -> list[list[int, int, int]]:
    """Returns the all released version of the database schema

    Args:
        schema_project_path: The path to the schema project folder.

    Returns:
        The list of released database versions as list of list of 3 ints.
    """
    if schema_project_path is None:
        raise ValueError("No schema_project_path given.")

    # Look at all files and get the highest version
    files = []
    for file in next(os.walk(os.path.join(schema_project_path, "releases", "versions")))[2]:
        files.append(file)

    versions = []
    for file in files:
        version_match = re.match(r".*?(\d+)\.(\d+)\.(\d+)\.sql", file)
        if version_match is not None:
            file_version = [int(version_match.group(
                1)), int(version_match.group(2)), int(version_match.group(3))]
            versions.append(file_version)

    versions.sort()

    return versions


def get_updatable_versions(schema_project_path: str) -> list[list[int, int, int]]:
    """Returns the all version that have update scripts

    Args:
        schema_project_path: The path to the schema project folder.

    Returns:
        The list of updatable database versions as list of list of 3 ints.
    """
    if schema_project_path is None:
        raise ValueError("No schema_project_path given.")

    # Look at all files and get the highest version
    files = []
    for file in next(os.walk(os.path.join(schema_project_path, "releases", "updates")))[2]:
        files.append(file)

    versions = []
    versions_to = []
    for file in files:
        version_match = re.match(
            r".*?(\d+)\.(\d+)\.(\d+)_to_(\d+)\.(\d+)\.(\d+)\.sql", file)
        if version_match is not None:
            file_version = [int(version_match.group(
                1)), int(version_match.group(2)), int(version_match.group(3))]
            versions.append(file_version)
            to_version = [int(version_match.group(
                4)), int(version_match.group(5)), int(version_match.group(6))]
            versions_to.append(to_version)

    versions.sort()
    versions_to.sort()

    # Check if there are any missing version updates
    if len(versions) > 0:
        versions_to.insert(0, versions[0])
        del versions_to[-1]

        missing_upgrade_from = None
        missing_upgrade_to = None
        for i in range(len(versions)):
            if versions[i] != versions_to[i]:
                missing_upgrade_from = versions[i]
                missing_upgrade_to = versions_to[i]
            else:
                continue
            break

        if missing_upgrade_from is not None:
            raise Exception(
                "The list of upgrade scripts misses an upgrade step from "
                f"version {missing_upgrade_from} to {missing_upgrade_to}. "
                "Please create the required update script.")

    return versions


def get_last_released_version(schema_project_path: str) -> list[int, int, int] | None:
    """Returns the last released version of the database schema

    Args:
        schema_project_path: The path to the schema project folder.

    Returns:
        The version of the last released version or None if no version was released yet
    """
    versions = get_released_versions(schema_project_path)

    if len(versions) > 0:
        return versions[len(versions) - 1]
    else:
        return None


def get_deployment_script_versions(schema_project_path: str) -> list[list[int, int, int]]:
    """Returns the all deployed version of the database schema

    Args:
        schema_project_path: The path to the schema project folder.

    Returns:
        The list of deployed database versions as list of list of 3 ints.
    """
    if schema_project_path is None:
        raise ValueError("No schema_project_path given.")

    # Look at all files and get the highest version
    files = []
    for file in next(os.walk(os.path.join(schema_project_path, "releases", "deployment")))[2]:
        files.append(file)

    versions = []
    for file in files:
        version_match = re.match(r".*?(\d+)\.(\d+)\.(\d+)\.sql", file)
        if version_match is not None:
            file_version = [int(version_match.group(
                1)), int(version_match.group(2)), int(version_match.group(3))]
            versions.append(file_version)

    versions.sort()

    return versions


def get_project_info(schema_project_path: str) -> dict:
    """Returns information about the project

    Args:
        schema_project_path: The path to the schema project folder.

    Returns:
        A dict with information about the project
    """

    project_info = get_project_settings(schema_project_path)
    project_info["currentDevelopmentVersion"] = get_schema_development_version(
        schema_project_path=schema_project_path)
    last_released_version = get_last_released_version(
        schema_project_path)
    project_info["lastReleasedVersion"] = (
        '%d.%d.%d' % tuple(last_released_version) if last_released_version is not None else None)
    project_info["schemaDevelopmentFilePath"] = get_schema_development_file_path(
        schema_project_path)

    return project_info


def sql_content_has_no_statement(sql_content: str, pattern: re.Pattern[str] = None) -> bool:
    """Removes all comments and delimiter statements

    Args:
        section_content: The section content

    Returns:
        True if the section content only contains comments or delimiter statements
    """

    if pattern is None:
        pattern = re.compile(
            MSM_SECTION_REMOVE_COMMENTS_AND_DELIMITERS, re.MULTILINE | re.DOTALL)

    return re.sub(pattern, "", sql_content, 0).strip() == ""


def remove_empty_sections(sections: dict, keep_even_if_empty=list[str]) -> None:
    """Removes all empty sections from the given section dict

    Args:
        sections: The section dict with all sections
        keep_even_if_empty: A list of section ids that should kept even if empty

    Returns:
        None
    """

    pattern = re.compile(
        MSM_SECTION_REMOVE_COMMENTS_AND_DELIMITERS, re.MULTILINE | re.DOTALL)

    sections_to_remove = []

    for section_id in sections:
        if section_id not in keep_even_if_empty:
            section = sections[section_id]
            full_content = section.get("full_content", "")
            if sql_content_has_no_statement(full_content, pattern):
                sections_to_remove.append(section_id)

    for section_id in sections_to_remove:
        sections.pop(section_id, None)


def prepare_release(
        schema_project_path: str, version: str, next_version: str, allow_to_stay_on_same_version: bool = False,
        overwrite_existing: bool = False) -> list[str]:
    """Adds a new release to the schema project

    Args:
        schema_project_path: The path to the schema project folder.
        version: The new version to create.
        next_version: The next development version.
        allow_to_stay_on_same_version: Whether to allow to stay on the
            same version for further development work
        overwrite_existing: Whether existing files should be overwritten. Defaults to False.

    Returns:
        A list of filenames that have been created or changed for the release
    """

    project_settings = get_project_settings(schema_project_path)
    schema_name = project_settings.get("schemaName")
    schema_file_name = project_settings.get("schemaFileName")

    last_released_version = get_last_released_version(schema_project_path)
    version_as_ints = lib.core.convert_version_str_to_list(version)

    files_for_release = []

    # Ensure provided version are OK
    if last_released_version is not None:
        if last_released_version > version_as_ints:
            raise ValueError(
                f"The given version {version} is lower than the last released "
                f"version {'%d.%d.%d' % tuple(last_released_version)}.")

    if not allow_to_stay_on_same_version and lib.core.convert_version_str_to_list(next_version) <= version_as_ints:
        raise ValueError(
            "The next development version needs to be higher than the version for release "
            f"{version}. Please explicitly pass the according flag to stay on the same version.")
    elif allow_to_stay_on_same_version and lib.core.convert_version_str_to_list(next_version) < version_as_ints:
        raise ValueError(
            "The next development version needs to be at least at the same version as the version for release "
            f"{version}.")

    # Get the current schema development file sections
    schema_dev_file_path = os.path.join(
        schema_project_path, "development", f"{schema_file_name}_next.sql")
    if not os.path.exists(schema_dev_file_path):
        raise ValueError(
            f"The MSM project folder does not contain a schema development file `{schema_dev_file_path}`.")
    with open(schema_dev_file_path, "r") as f:
        schema_dev_script = f.read()
    # Make sure to resolve SOURCE statements with actual content
    schema_dev_script = substitute_source_statements_with_content(
        schema_dev_script, os.path.dirname(schema_dev_file_path))
    schema_dev_expanded_sections = get_script_sections(schema_dev_script)

    # Prepare the schema version template file
    template_folder = os.path.join(Path(__file__).parent.parent, "templates")
    schema_version_template_file_path = os.path.join(
        template_folder, "scripts", "schema_a.b.c.sql")
    if not os.path.exists(schema_version_template_file_path):
        raise ValueError(
            f"The schema release version template file `{schema_version_template_file_path}` does not exist.")
    with open(schema_version_template_file_path, "r") as f:
        # Remove copyright line and replace placeholders
        schema_version_script = Template("".join(f.readlines()[1:]))
    schema_version_script = schema_version_script.substitute({
        # get_license_text(project_settings=project_settings),
        "license": "License Placeholder",
        "schema_name": schema_name,
        "version_str": version,
        "version_comma_str": ", ".join(str(number) for number in version_as_ints),
    })
    schema_version_sections = get_script_sections(schema_version_script)

    # Get the version section of the current schema development file
    schema_dev_version_section = schema_dev_expanded_sections.get("910", None)
    if schema_dev_version_section is None:
        raise ValueError(
            "The script section `MSM Section 910: Database Schema Version` could not be found in "
            f"`{schema_dev_file_path}`.")

    # Loop over all sections of the version file and replace the sections with the ones from the development file
    for section_id in schema_version_sections:
        section = schema_dev_expanded_sections.get(section_id, None)
        if section is not None:
            schema_version_sections[section_id] = section

    remove_empty_sections(
        sections=schema_version_sections,
        keep_even_if_empty=["license", "001"])

    # Write the schema version file out
    schema_version_file_path = os.path.join(
        schema_project_path, "releases", "versions", f"{schema_file_name}_{version}.sql")
    write_sections_to_file(
        file_path=schema_version_file_path,
        sections=schema_version_sections,
        overwrite_existing=overwrite_existing)
    files_for_release.append(schema_version_file_path)

    # Check if update script is needed and if so, write it out
    if last_released_version is not None:
        last_released_version_str = '%d.%d.%d' % tuple(last_released_version)
        if last_released_version_str != version:
            schema_update_file_path = os.path.join(
                schema_project_path, "releases", "updates",
                f"{schema_file_name}_{last_released_version_str}_to_{version}.sql")
            copy_template_file_and_substitute(
                source_file_path=os.path.join(
                    template_folder, "scripts", "schema_x.y.z_to_a.b.c.sql"),
                target_file_path=schema_update_file_path,
                substitutions={
                    "license": get_license_text(project_settings=project_settings),
                    "schema_name": schema_name,
                    "version_from": last_released_version_str,
                    "version_to": version,
                    "version_comma_str": ", ".join(
                        str(number) for number in lib.core.convert_version_str_to_list(version)),
                })
            files_for_release.append(schema_update_file_path)

    # Update the version of the development schema file store in section
    # MSM Section 910: Database Schema Version
    set_development_version(new_version=next_version,
                            schema_project_path=schema_project_path,
                            write_to_file=True)

    return files_for_release


def generate_deployment_script(
        schema_project_path: str, version: str, overwrite_existing: bool = False) -> str:
    """Generate the deployment script for a release

    Args:
        schema_project_path: The path to the schema project folder.
        version: The version to generate the deployment script for.
        overwrite_existing: Whether existing files should be overwritten. Defaults to False.

    Returns:
        The file name path of the generated script
    """
    project_settings = get_project_settings(schema_project_path)
    schema_name = project_settings.get("schemaName")
    schema_file_name = project_settings.get("schemaFileName")

    # Build deployment file path that will be used for output and check that it does not exist
    deployment_file_path = os.path.join(
        schema_project_path, "releases", "deployment",
        f"{schema_file_name}_deployment_{version}.sql")
    if os.path.exists(deployment_file_path) and not overwrite_existing:
        raise ValueError(
            f"The file {deployment_file_path} already exists. Please explicitly allow to replace existing files.")

    # Build the version file path that is used as a source and check that it does exist
    version_file_path = os.path.join(
        schema_project_path, "releases", "versions",
        f"{schema_file_name}_{version}.sql")

    if not os.path.exists(version_file_path):
        raise ValueError(
            f"The file {version_file_path} does not exist exists. Please make "
            f"sure to prepare the release {version} first.")

    # Get the version script file section
    target_version_sections = get_file_sections(version_file_path)

    version_as_ints = lib.core.convert_version_str_to_list(version)

    # Ensure there are no missing updates between 2 released versions
    updatable_versions = get_updatable_versions(schema_project_path)

    # Get the list of released version and build list of updatable versions
    released_versions = get_released_versions(schema_project_path)
    i = 0
    updatable_versions = []
    updatable_versions_sections = {}
    while i + 1 < len(released_versions) and released_versions[i] < version_as_ints:
        version_from = '%d.%d.%d' % tuple(released_versions[i])
        version_to = '%d.%d.%d' % tuple(released_versions[i + 1])

        updatable_versions.append(version_from)
        updatable_versions_sections[version_from] = {
            "version_from": released_versions[i],
            "version_to": released_versions[i + 1],
            "sections": get_file_sections(os.path.join(
                schema_project_path, "releases", "updates",
                f"{schema_file_name}_{version_from}_to_{version_to}.sql")),
        }
        i += 1

    if len(released_versions) == 0:
        raise ValueError(
            "Please prepare a version for release before generating a deployment script.")

    # If there is exactly one released versions yet, use the version SQL script as deployment script
    if len(released_versions) == 1:
        shutil.copyfile(version_file_path, deployment_file_path)
        return deployment_file_path

    # Prepare the schema version template file
    template_folder = os.path.join(Path(__file__).parent.parent, "templates")
    schema_deployment_template_file_path = os.path.join(
        template_folder, "scripts", "schema_deployment_a.b.c.sql")
    if not os.path.exists(schema_deployment_template_file_path):
        raise ValueError(
            f"The schema release version template file `{schema_deployment_template_file_path}` does not exist.")
    with open(schema_deployment_template_file_path, "r") as f:
        # Remove copyright line and replace placeholders
        schema_deployment_script = Template("".join(f.readlines()[1:]))
    schema_deployment_script = schema_deployment_script.safe_substitute({
        "license": get_license_text(project_settings=project_settings),
        "schema_name": schema_name,
        "version_target": version,
        "version_comma_str": ", ".join(str(number) for number in version_as_ints),
        "section_130_creation_of_helpers":
            target_version_sections.get("130", {}).get("sql_content", ""),
        "section_140_non_idempotent_schema_objects": indent(
            target_version_sections.get("140", {}).get("sql_content", ""), "    "),
        "section_150_idempotent_schema_objects":
            target_version_sections.get("150", {}).get("sql_content", ""),
        "section_170_authorization": indent(
            target_version_sections.get("170", {}).get("sql_content", ""), "    "),
        "section_190_removal_of_helpers":
            target_version_sections.get("190", {}).get("sql_content", ""),
        "updatable_versions": ", ".join(f'"{v}"' for v in updatable_versions),
    })

    matches = re.finditer(
        MSM_LOOP_UPDATABLE_VERSIONS_REGEX, schema_deployment_script, re.MULTILINE | re.DOTALL)
    # for match_id, match in enumerate(matches, start=1):
    #     print("Match {match_id} was found at {start}-{end}: {match}".format(
    #         match_id=match_id, start=match.start(), end=match.end(), match=match.group()))
    #     for group_id in range(0, len(match.groups())):
    #         group_id = group_id + 1
    #         print("Group {group_id} found at {start}-{end}: {group}".format(group_id=group_id,
    #               start=match.start(group_id), end=match.end(group_id), group=match.group(group_id)))

    for match in reversed(list(matches)):
        loop_content_template = match.group(3)
        loop_content = ""
        needs_indent = match.group(2)
        if needs_indent is None or needs_indent == "":
            needs_indent = 0
        else:
            needs_indent = int(needs_indent)

        for version_from in updatable_versions_sections:
            loop_version_content = loop_content_template
            sections_to_replace = reversed(list(
                re.finditer(MSM_SECTION_PLACEHOLDER_REGEX, loop_content_template)))
            for s in sections_to_replace:
                section_id = s.group(1)
                sql_content = updatable_versions_sections[version_from]["sections"].get(
                    section_id, {}).get("sql_content", "")
                sql_content_indent = indent(
                    sql_content, " " * needs_indent) if needs_indent else sql_content
                sql_content_indent += "\n"

                # If the sql_content has no SQL statements, do not insert
                if sql_content_has_no_statement(sql_content_indent):
                    sql_content_indent = ""

                loop_version_content = (
                    loop_content_template[:s.start()]
                    + sql_content_indent
                    + loop_content_template[s.end():])

            loop_content += Template(loop_version_content).safe_substitute({
                "version_from": '%d.%d.%d' % tuple(updatable_versions_sections[version_from]["version_from"]),
                "version_to": '%d.%d.%d' % tuple(updatable_versions_sections[version_from]["version_to"]),
            })

        # Check if the loop_content is empty (TODO: check if it contains no statements) and if so
        # insert a placeholder
        if len(updatable_versions_sections) > 0 and loop_content == "" and needs_indent > 0:
            loop_content = " " * needs_indent + "DO NONE;\n"

        if sql_content_has_no_statement(loop_content):
            loop_content = ""

        schema_deployment_script = (
            schema_deployment_script[:match.start()]
            + loop_content
            + schema_deployment_script[match.end():])

    # Remove empty sections
    schema_deployment_script_sections = get_script_sections(
        schema_deployment_script)
    remove_empty_sections(
        sections=schema_deployment_script_sections,
        keep_even_if_empty=["license", "003"])

    write_sections_to_file(
        file_path=deployment_file_path,
        sections=schema_deployment_script_sections,
        overwrite_existing=overwrite_existing)

    # with open(deployment_file_path, "w") as f:
    #     f.write(schema_deployment_script)

    return deployment_file_path


def get_available_licenses() -> list[str]:
    """Returns the list of available licenses

    Returns:
        The available licenses as a list of strings
    """
    template_folder = os.path.join(Path(__file__).parent.parent, "templates")
    license_path = os.path.join(template_folder, "license")

    files = []
    for file in next(os.walk(license_path))[2]:
        files.append(file[:-4])
    files.sort()

    return files


def substitute_source_statements_with_content(script: str, source_absolute_file_path: str):
    """Returns the script with substituted source statements

    Args:
        script: The script content as string
        source_absolute_file_path: The absolute path of the referenced script files

    Returns:
        The script with substituted source statements
    """

    matches = re.finditer(
        MSM_SECTION_SOURCE_REGEX, script, re.MULTILINE | re.DOTALL)
    # for match_id, match in enumerate(matches, start=1):
    #     print("Match {match_id} was found at {start}-{end}: {match}".format(
    #         match_id=match_id, start=match.start(), end=match.end(), match=match.group()))
    #     for group_id in range(0, len(match.groups())):
    #         group_id = group_id + 1
    #         print("Group {group_id} found at {start}-{end}: {group}".format(group_id=group_id,
    #               start=match.start(group_id), end=match.end(group_id), group=match.group(group_id)))

    for match in reversed(list(matches)):
        source_file_path = match.group(1)
        source_slicing = match.group(2)

        # If a relative file path is defined in the SOURCE statement, convert it to an absolute path
        if not source_file_path.startswith("/"):
            source_file_path = os.path.normpath(os.path.join(
                source_absolute_file_path, source_file_path))

        if not os.path.exists(source_file_path):
            raise ValueError(
                f"The give SOURCE file path `{source_file_path}` could not be resolved.")

        with open(source_file_path, "r") as f:
            source_file_content = f.read()

            # If slicing was defined for the source content, only get the relevant substring
            if source_slicing is not None:
                if source_slicing.startswith(":"):
                    source_file_content = source_file_content[:int(
                        source_slicing[1:])]
                else:
                    slices = source_slicing.split(":")
                    source_file_content = source_file_content[int(
                        slices[0]):int(slices[1]) if slices[1] else None]

        script = (
            script[:match.start()]
            + source_file_content
            + script[match.end():])

    return script


def get_schema_name(schema_project_path: str):
    """Gets the schema name from the project settings

    Args:
        schema_project_path (str): The path to the schema project.

    Returns:
        The schema name
    """
    project_settings = get_project_settings(schema_project_path)
    schema_name = project_settings.get("schemaName", None)
    if schema_name is None:
        raise ValueError(
            "The schema name could not be read from the project settings.")

    return schema_name


def get_schema_exists(
        session: object, schema_project_path: str = None,
        schema_name: str = None) -> bool:
    """Checks whether the given schema exists

    Either the schema_project_path or the schema_name can be given.

    Args:
        session (object): The database session to use.
        schema_project_path (str): The path to the schema project.
        schema_name (str): The name of the schema

    Returns:
        True if the schema exists
    """
    if schema_name is None:
        schema_name = get_schema_name(schema_project_path)

    return (lib.core.MsmDbExec(
        'SELECT COUNT(*) as schema_count FROM information_schema.SCHEMATA '
        'WHERE SCHEMA_NAME = ?'
    ).exec(session, [schema_name]).first["schema_count"] == 1)


def get_schema_is_managed(session: object, schema_project_path: str = None,
                          schema_name: str = None) -> bool:
    """Checks whether the given schema is managed

    Either the schema_project_path or the schema_name can be given.

    Args:
        session (object): The database session to use.
        schema_project_path (str): The path to the schema project.
        schema_name (str): The name of the schema

    Returns:
        True if the schema is managed by MSM
    """
    if schema_name is None:
        schema_name = get_schema_name(schema_project_path)

    return (lib.core.MsmDbExec(
            'SELECT COUNT(*) as table_count FROM information_schema.TABLES '
            'WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? AND TABLE_TYPE = "VIEW"'
            ).exec(session, [schema_name, "msm_schema_version"])
            .first["table_count"] == 1)


def get_schema_version(session: object, schema_project_path: str = None,
                       schema_name: str = None) -> str | None:
    """Returns the current version of the schema

    Either the schema_project_path or the schema_name can be given.

    Args:
        session (object): The database session to use.
        schema_project_path (str): The path to the schema project.
        schema_name (str): The name of the schema

    Returns:
        True if the schema is managed by msm
    """
    if schema_name is None:
        schema_name = get_schema_name(schema_project_path)

    if get_schema_exists(session=session, schema_name=schema_name):
        schema_version = lib.core.MsmDbExec(
            "SELECT CONCAT(major, '.', minor, '.', patch) AS version "
            f"FROM {lib.core.quote_ident(schema_name)}.`msm_schema_version`"
        ).exec(session).first["version"]
    else:
        schema_version = None

    return schema_version


def deploy_schema(
        session: object, schema_project_path: str, version: str = None,
        backup_directory: str = None) -> str:
    """Deploys the database schema

    Deploys the given version of the database schema. If no version is given,
    the latest available version will be deployed.

    If there is an existing schema version that will be upgraded, a dump of
    that schema is created in order to be able to roll back.

    A log will be written during the update.

    Args:
        session (object): The database session to use.
        schema_project_path (str): The path to the schema project.
        version (str): The version to deploy.
        backup_directory (str): The directory to be used for backups

    Returns:
        None
    """
    project_settings = get_project_settings(schema_project_path)
    schema_name = project_settings.get("schemaName", None)
    if schema_name is None:
        err_msg = (
            f"The project settings of `{schema_project_path}` could not be "
            "read.")
        lib.core.write_to_msm_schema_update_log("ERROR", err_msg)
        raise ValueError(err_msg)
    schema_file_name = project_settings.get("schemaFileName", None)

    released_versions = get_released_versions(
        schema_project_path=schema_project_path)
    deployment_script_versions = get_deployment_script_versions(
        schema_project_path=schema_project_path)

    # Check if there are actually any released versions of the schema
    if len(released_versions) == 0:
        err_msg = (
            f"There are no versions of the schema `{schema_name}` that have "
            "been released yet.")
        lib.core.write_to_msm_schema_update_log("ERROR", err_msg)
        raise Exception(err_msg)

    # Check if there is a difference in released versions and deployment scripts
    if released_versions != deployment_script_versions:
        err_msg = (
            "Deployment script(s) missing. Please generate deployment "
            "scripts for all released versions first.")
        lib.core.write_to_msm_schema_update_log("ERROR", err_msg)
        raise Exception(err_msg)

    # If a specific version is requested, ensure that there is a deployment
    # script for this version
    if version is None:
        version = '%d.%d.%d' % tuple(deployment_script_versions[-1])
    elif version not in map(
            lambda v: '%d.%d.%d' % tuple(v), deployment_script_versions):
        err_msg = (f"Deployment or update of database schema `{schema_name}` using "
            f"version {version} requested but there is no deployment script "
            "available for this version.")
        lib.core.write_to_msm_schema_update_log("ERROR", err_msg)
        raise ValueError(err_msg)

    # Check if the schema already exists
    schema_exists = get_schema_exists(session=session, schema_name=schema_name)

    # Check if the schema is actually managed by MSM, and if so, get the version
    schema_managed = False
    schema_version = None
    if schema_exists:
        schema_managed = get_schema_is_managed(
            session=session, schema_name=schema_name)

        if schema_managed:
            schema_version = get_schema_version(
                session=session, schema_name=schema_name)

    if schema_exists and not schema_managed:
        err_msg = (
            f"Deployment or update of database schema `{schema_name}` using "
            f"version {version} requested but the schema is not managed by "
            "MSM.")
        lib.core.write_to_msm_schema_update_log("ERROR", err_msg)
        raise Exception(err_msg)

    # If the requested version already matches the version, exit since there is
    # nothing to do
    if schema_version is not None and schema_version == version:
        info_msg = (
            f"Deployment or update of database schema `{schema_name}` using "
            f"version {version} requested but the schema is already on the "
            "requested version. No changes required."
        )
        lib.core.write_to_msm_schema_update_log("INFO", info_msg)
        return info_msg

    # Check if the current version of the schema is in the list of versions
    # that can be upgraded by the deployment scripts
    if schema_version is not None:
        updatable_versions = map(
            lambda v: '%d.%d.%d' % tuple(v),
            get_updatable_versions(schema_project_path))

        if not schema_version in updatable_versions:
            err_msg = (f"Update of database schema `{schema_name}` to version "
                f"{version} requested but this version cannot be updated.")
            lib.core.write_to_msm_schema_update_log("INFO", err_msg)
            raise Exception(err_msg)

    # Log start of the
    if not schema_exists:
        lib.core.write_to_msm_schema_update_log(
            "INFO",
            f"Starting deployment of database schema `{schema_name}` using "
            f"version {version} requested but the schema is already on the "
            "requested version. No changes required.")
    else:
        lib.core.write_to_msm_schema_update_log(
            "INFO",
            f"Starting update of database schema `{schema_name}` version "
            f"{schema_version} to version {version}")

    # Perform dump if the schema exists
    backup_available = False
    if schema_exists:
        lib.core.write_to_msm_schema_update_log(
            "INFO",
            f"Preparing dump of `{schema_name}` version "
            f"{schema_version} in order to be roll back in case of an error.")

        if backup_directory is None:
            backup_directory = os.path.join(
                lib.core.get_msm_plugin_data_path(),
                "backups", f"{schema_file_name}_backup_{schema_version}")

        os.makedirs(backup_directory, exist_ok=True)

        mysqlsh.globals.util.dump_schemas(
            [schema_name],
            f"file://{backup_directory}",
            {
                "skipUpgradeChecks": True,
                "showProgress": False,
            })

        backup_available = True

    # Run deployment script
    try:
        lib.core.execute_msm_sql_script(
            session=session,
            sql_file_path=os.path.join(
                schema_project_path, "releases", "deployment",
                f"{schema_file_name}_deployment_{version}.sql"))

        if not schema_exists:
            info_msg = (
                f"Completed the deployment of `{schema_name}` version "
                f"{version} successfully.")
        else:
            info_msg = (
                f"Completed the update of `{schema_name}` version "
                f"{schema_version} to {version} successfully.")

        lib.core.write_to_msm_schema_update_log("INFO", info_msg)

        return info_msg
    except Exception as e:
        # Drop the schema after failed update
        lib.core.MsmDbExec(
            f"DROP SCHEMA {lib.core.quote_ident(schema_name)}"
        ).exec(session)

        # Restore the backup if available
        if backup_available:
            try:
                mysqlsh.globals.util.load_dump(
                    f"file://{backup_directory}",
                    {
                        "showMetadata": False,
                        "showProgress": False,
                        "ignoreVersion": True,
                    })
            except Exception as e_dump_load:
                err_str = (
                    "An error occurred while updating the database schema "
                    f"`{schema_name}` to version {version}. The schema could "
                    f"not be restored back to version {schema_version}. {e} "
                    f"{e_dump_load}")
                lib.core.write_to_msm_schema_update_log("ERROR", err_str)

                raise Exception(err_str)

            err_str = (
                "An error occurred while updating the database schema "
                f"`{schema_name}` to version {version}. The schema has been"
                f"restored back to version {schema_version}. {e}"
            )
            lib.core.write_to_msm_schema_update_log("ERROR", err_str)

            raise Exception(err_str)
        else:
            if not schema_exists:
                err_str = (
                    "Deploying the database schema `{schema_name}` failed. {e}"
                )
                lib.core.write_to_msm_schema_update_log("ERROR", err_str)

                raise Exception(err_str)
            else:
                err_str = (
                    "An error occurred while updating the database schema "
                    f"`{schema_name}` to version {version}. {e}"
                )
                lib.core.write_to_msm_schema_update_log("ERROR", err_str)

                raise Exception(err_str)
