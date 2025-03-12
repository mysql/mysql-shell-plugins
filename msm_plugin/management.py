# Copyright (c) 2025 Oracle and/or its affiliates.
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

"""The MySQL Shell Schema Plugin - Management"""

# cSpell:ignore mysqlsh

import json
from mysqlsh.plugin_manager import plugin_function
from msm_plugin import lib
import re


@plugin_function('msm.createNewProjectFolder', shell=True, cli=True, web=True)
def create_new_project_folder(
        schema_name: str = None, target_path: str = None, copyright_holder: str = None, **kwargs) -> str | None:
    """Creates a new schema project folder.

    Args:
        schema_name (str): The name of the schema.
        target_path (str): The path to the schema project folder.
        copyright_holder (str): The name of the copyright holder.
        **kwargs: Additional options.

    Keyword Args:
        overwrite_existing (bool): If the project folder already exists, overwrite it.
        allow_special_chars (bool): If set to True, allows all characters
        license (str): The license to use for the project.
        enforce_target_path (bool): If set to true, the target_path is created if it does not yet exist.

    Returns:
        None
    """

    overwrite_existing = kwargs.get('overwrite_existing', False)
    allow_special_chars = kwargs.get("allow_special_chars", False)
    license = kwargs.get('license', None)
    enforce_target_path = kwargs.get('enforce_target_path', False)

    if schema_name is None and lib.core.get_interactive_default():
        schema_name = lib.core.prompt('Enter the database schema name: ')

    lib.management.check_mysql_identifier(
        identifier=schema_name,
        must_be_usable_when_unquoted=not allow_special_chars)

    if target_path is None and lib.core.get_interactive_default():
        target_path = lib.core.prompt(
            'Enter the path the project folder should be created in: ')

    if copyright_holder is None and lib.core.get_interactive_default():
        copyright_holder = lib.core.prompt(
            'Enter the name of the copyright holder: ')

    if schema_name is None or schema_name == "" or target_path is None or target_path == "":
        raise ValueError(
            'Both schema_name and schema_project_path must be provided.')

    if license is None:
        license = "None"

    try:
        project_path = lib.management.create_schema_project_folder(
            schema_name=schema_name, target_path=target_path, copyright_holder=copyright_holder, license=license,
            overwrite_existing=overwrite_existing, allow_special_chars=allow_special_chars,
            enforce_target_path=enforce_target_path)

        if lib.core.get_interactive_default():
            print(
                f'The project folder "{project_path}" has been created successfully.')
    except ValueError as e:
        if lib.core.get_interactive_default():
            print(str(e))
        else:
            raise e

    if not lib.core.get_interactive_default():
        return project_path


@plugin_function('msm.get.projectSettings', shell=True, cli=True, web=True)
def get_project_settings(**kwargs) -> dict | None:
    """Returns information about the schema project

    Args:
        **kwargs: Additional options.

    Keyword Args:
        schema_project_path (str): The path to the schema project.

    Returns:
        A dict with information about the schema project.
    """
    schema_project_path = kwargs.get(
        'schema_project_path', lib.core.get_working_dir())

    project_settings = lib.management.get_project_settings(
        schema_project_path=schema_project_path)

    if lib.core.get_interactive_default():
        print(json.dumps(project_settings, indent=4))
    else:
        return project_settings


@plugin_function('msm.get.projectInformation', shell=True, cli=True, web=True)
def get_project_information(**kwargs) -> dict | None:
    """Returns information about the schema project

    Args:
        **kwargs: Additional options.

    Keyword Args:
        schema_project_path (str): The path to the schema project.

    Returns:
        A dict with information about the schema project.
    """
    schema_project_path = kwargs.get(
        'schema_project_path', lib.core.get_working_dir())

    project_info = lib.management.get_project_info(
        schema_project_path=schema_project_path)

    if lib.core.get_interactive_default():
        print(json.dumps(project_info, indent=4))
    else:
        return project_info


@plugin_function('msm.set.developmentVersion', shell=True, cli=True, web=True)
def set_development_version(**kwargs) -> None:
    """Sets the development version inside the development/schema_next.sql file

    Args:
        **kwargs: Additional options.

    Keyword Args:
        schema_project_path (str): The path to the schema project.
        version (str): The new version to create.

    Returns:
        None
    """
    schema_project_path = kwargs.get(
        'schema_project_path', lib.core.get_working_dir())
    version = kwargs.get('version', None)

    current_dev_version = lib.management.get_schema_development_version(
        schema_project_path)

    if version is None and lib.core.get_interactive_default():
        version = lib.core.prompt(
            "Please enter the version to be used for the release "
            f"({current_dev_version}): ")
        if version == "":
            version = current_dev_version
        elif re.match(r"\d+\.\d+\.\d+", version) is None:
            raise ValueError(
                "The version has to be provided in the following format: major.minor.patch")
    elif version is None:
        raise ValueError("No version specified.")

    lib.management.set_development_version(
        schema_project_path=schema_project_path,
        new_version=version, write_to_file=True)


@plugin_function('msm.get.releasedVersions', shell=True, cli=True, web=True)
def get_released_versions(**kwargs) -> list[list[int, int, int]] | None:
    """Returns the all released version of the database schema

    Args:
        **kwargs: Additional options.

    Keyword Args:
        schema_project_path (str): The path to the schema project.

    Returns:
        The list of released versions or None
    """
    schema_project_path = kwargs.get(
        'schema_project_path', lib.core.get_working_dir())

    released_versions = lib.management.get_released_versions(
        schema_project_path=schema_project_path)

    if lib.core.get_interactive_default():
        if len(released_versions) > 0:
            print("\n".join(".".join(str(number) for number in version)
                            for version in released_versions))
        else:
            print("None")
    else:
        return released_versions


@plugin_function('msm.get.lastReleasedVersion', shell=True, cli=True, web=True)
def get_last_released_version(**kwargs) -> list[int, int, int] | None:
    """Returns the last released version of the database schema

    Args:
        **kwargs: Additional options.

    Keyword Args:
        schema_project_path (str): The path to the schema project.

    Returns:
        The last released version
    """
    schema_project_path = kwargs.get(
        'schema_project_path', lib.core.get_working_dir())

    last_version = lib.management.get_last_released_version(
        schema_project_path=schema_project_path)

    if lib.core.get_interactive_default():
        print('%d.%d.%d' % tuple(last_version)
              if last_version is not None else "None")
    else:
        return last_version


@plugin_function('msm.get.lastDeploymentVersion', shell=True, cli=True, web=True)
def get_last_deployment_version(**kwargs) -> list[int, int, int] | None:
    """Returns the last deployment version of the database schema

    Args:
        **kwargs: Additional options.

    Keyword Args:
        schema_project_path (str): The path to the schema project.

    Returns:
        The last deployment version
    """
    schema_project_path = kwargs.get(
        'schema_project_path', lib.core.get_working_dir())

    last_version = lib.management.get_last_deployment_script_version(
        schema_project_path=schema_project_path)

    if lib.core.get_interactive_default():
        print('%d.%d.%d' % tuple(last_version)
              if last_version is not None else "None")
    else:
        return last_version


@plugin_function('msm.prepareRelease', shell=True, cli=True, web=True)
def prepare_release(**kwargs) -> list[str]:
    """Adds a new database schema release

    Args:
        **kwargs: Additional options.

    Keyword Args:
        schema_project_path (str): The path to the schema project.
        version (str): The new version to create.
        next_version (str): The next development version.
        allow_to_stay_on_same_version (bool): Whether to allow to stay on the same version for further development
            work. Defaults to False.
        overwrite_existing (bool): Whether existing files should be overwritten. Defaults to False.

    Returns:
        The list of generated files
    """
    schema_project_path = kwargs.get(
        'schema_project_path', lib.core.get_working_dir())
    version = kwargs.get('version', None)
    next_version = kwargs.get('next_version', None)
    allow_to_stay_on_same_version = kwargs.get(
        'allow_to_stay_on_same_version', False)
    overwrite_existing = kwargs.get('overwrite_existing', False)

    project_info = lib.management.get_project_info(
        schema_project_path=schema_project_path)
    current_dev_version = project_info.get("currentDevelopmentVersion")
    last_released_version = project_info.get("lastReleasedVersion")

    if version is None and lib.core.get_interactive_default():
        version = lib.core.prompt(
            "Please enter the version to be used for the release "
            f"({current_dev_version}): ")
        if version == "":
            version = current_dev_version
        elif re.match(r"\d+\.\d+\.\d+", version) is None:
            raise ValueError(
                "The version has to be provided in the following format: major.minor.patch")
    elif version is None:
        raise ValueError("No version specified.")

    if (last_released_version is not None
        and lib.core.convert_version_str_to_list(last_released_version) >
            lib.core.convert_version_str_to_list(version)):
        raise ValueError(
            f"The given version {version} is lower than the last released version {last_released_version}.")

    if next_version is None and lib.core.get_interactive_default():
        next_version = lib.core.convert_version_str_to_list(version)
        next_version[2] = next_version[2] + 1
        next_version_proposal = ".".join(
            str(number) for number in next_version)
        next_version = lib.core.prompt(
            "Please enter the next version to used for development "
            f"({next_version_proposal}): ")
        if next_version == "":
            next_version = next_version_proposal
        elif (not allow_to_stay_on_same_version
              and lib.core.convert_version_str_to_list(next_version) <= lib.core.convert_version_str_to_list(version)):
            confirmation = lib.core.prompt(
                "Are you sure to not increase the version of the database schema that is being worked on?"
                f"(yes/NO): ")
            if confirmation != "yes":
                raise ValueError(
                    "The next development version needs to be higher than the version for release "
                    f"{version}.")
            allow_to_stay_on_same_version = True
    elif next_version is None:
        ValueError("No next_version specified.")

    files_for_release = lib.management.prepare_release(
        schema_project_path=schema_project_path,
        version=version,
        next_version=next_version,
        allow_to_stay_on_same_version=allow_to_stay_on_same_version,
        overwrite_existing=overwrite_existing)

    if lib.core.get_interactive_default():
        print("The following files have been prepared for release:\n"
              '\n'.join(files_for_release))
    else:
        return files_for_release


@plugin_function('msm.get.sqlContentFromSection', shell=True, cli=True, web=True)
def get_sql_content_from_section(file_path: str, section_id: str) -> str:
    """Returns the SQL content of a MSM section

    Args:
        file_path (str): The path of the SQL file.
        section_id (str): The id of the section.

    Returns:
        The SQL content as string
    """
    section = lib.management.get_file_section(
        file_path=file_path, section_id=section_id)

    if section is not None:
        sql_content, _start_position, _end_position = lib.management.get_sql_content(
            section["full_content"])
        return sql_content
    else:
        return None


@plugin_function('msm.set.sectionSqlContent', shell=True, cli=True, web=True)
def set_section_sql_content(file_path: str, section_id: str, sql_content: str) -> None:
    """Sets the SQL content of a MSM section of a file

    Args:
        file_path (str): The path of the SQL file.
        section_id (str): The id of the section.
        sql_content (str): The sql content to set

    Returns:
        None
    """

    lib.management.set_section_sql_content(
        file_path=file_path, section_id=section_id, sql_content=sql_content)


@plugin_function('msm.generateDeploymentScript', shell=True, cli=True, web=True)
def generate_deployment_script(**kwargs) -> str:
    """Generate the deployment script for a release

    Args:
        **kwargs: Additional options.

    Keyword Args:
        schema_project_path (str): The path to the schema project.
        version (str): The new version to create the deployment script for.
        overwrite_existing (bool): Whether existing files should be overwritten. Defaults to False.

    Returns:
        The file name of the development script
    """
    schema_project_path = kwargs.get(
        'schema_project_path', lib.core.get_working_dir())
    overwrite_existing = kwargs.get("overwrite_existing", False)

    version = kwargs.get('version', None)
    if version is None:
        last_released_version = lib.management.get_last_released_version(
            schema_project_path)
        last_released_version = (
            '%d.%d.%d' % tuple(last_released_version)
            if last_released_version is not None else None)
        version = lib.core.prompt(
            "Please enter the version to generate the deployment script for "
            f"({last_released_version}): ")
        if version == "":
            version = last_released_version
        elif re.match(r"\d+\.\d+\.\d+", version) is None:
            raise ValueError(
                "The version has to be provided in the following format: major.minor.patch")

    deployment_script_path = lib.management.generate_deployment_script(
        schema_project_path=schema_project_path,
        version=version,
        overwrite_existing=overwrite_existing)

    if lib.core.get_interactive_default():
        print(
            f"The deployment script `{deployment_script_path}` was created successfully.")
    else:
        return deployment_script_path


@plugin_function('msm.get.deploymentScriptVersions', shell=True, cli=True, web=True)
def get_deployment_script_versions(**kwargs) -> list[list[int, int, int]] | None:
    """Adds a new database schema release

    Args:
        **kwargs: Additional options.

    Keyword Args:
        schema_project_path (str): The path to the schema project.

    Returns:
        The list of deployed versions or None
    """
    schema_project_path = kwargs.get(
        'schema_project_path', lib.core.get_working_dir())

    deployed_versions = lib.management.get_deployment_script_versions(
        schema_project_path=schema_project_path)

    if lib.core.get_interactive_default():
        if len(deployed_versions) > 0:
            print("\n".join(".".join(str(number) for number in version)
                            for version in deployed_versions))
        else:
            print("None")
    else:
        return deployed_versions


@plugin_function('msm.get.availableLicenses', shell=True, cli=True, web=True)
def get_available_licenses() -> list[str]:
    """Returns the list of available licenses

    Returns:
        The available licenses as a list of strings
    """
    available_licenses = lib.management.get_available_licenses()

    if lib.core.get_interactive_default():
        print("\n".join(available_licenses))
    else:
        return available_licenses


@plugin_function('msm.get.schemaExists', shell=True, cli=True, web=True)
def get_schema_exists(**kwargs) -> bool:
    """Checks whether the given schema exists

    Args:
        **kwargs: Additional options.

    Keyword Args:
        schema_project_path (str): The path to the schema project.
        session (object): The database session to use.

    Returns:
        True if the schema exists
    """
    schema_project_path = kwargs.get(
        'schema_project_path', lib.core.get_working_dir())
    session = lib.core.get_current_session(kwargs.get("session", None))

    return lib.management.get_schema_exists(
        session=session,
        schema_project_path=schema_project_path
    )


@plugin_function('msm.get.schemaIsManaged', shell=True, cli=True, web=True)
def get_schema_is_managed(**kwargs) -> bool:
    """Checks whether the given schema is managed by MSM

    Args:
        **kwargs: Additional options.

    Keyword Args:
        schema_project_path (str): The path to the schema project.
        session (object): The database session to use.

    Returns:
        True if the schema is managed by MSM
    """
    schema_project_path = kwargs.get(
        'schema_project_path', lib.core.get_working_dir())
    session = lib.core.get_current_session(kwargs.get("session", None))

    return lib.management.get_schema_is_managed(
        session=session,
        schema_project_path=schema_project_path
    )


@plugin_function('msm.get.schemaVersion', shell=True, cli=True, web=True)
def get_schema_version(**kwargs) -> str | None:
    """Returns the current version of the database schema

    Args:
        **kwargs: Additional options.

    Keyword Args:
        schema_project_path (str): The path to the schema project.
        session (object): The database session to use.

    Returns:
        The current version as string or None if not managed by MSM
    """
    schema_project_path = kwargs.get(
        'schema_project_path', lib.core.get_working_dir())
    session = lib.core.get_current_session(kwargs.get("session", None))

    return lib.management.get_schema_version(
        session=session,
        schema_project_path=schema_project_path
    )


@plugin_function('msm.deploySchema', shell=True, cli=True, web=True)
def deploy_schema(**kwargs) -> str:
    """Deploys the database schema

    Deploys the given version of the database schema. If no version is given,
    the latest available version will be deployed.

    If there is an existing schema version that will be upgraded, a dump of
    that schema is created in order to be able to roll back.

    A log will be written during the update.

    Args:
        **kwargs: Additional options.

    Keyword Args:
        schema_project_path (str): The path to the schema project.
        version (str): The version to deploy.
        backup_directory (str): The directory to be used for backups
        session (object): The database session to use.

    Returns:
        A string containing information about the performed operation
    """
    schema_project_path = kwargs.get(
        'schema_project_path', lib.core.get_working_dir())
    version = kwargs.get("version", None)
    backup_directory = kwargs.get("backup_directory", None)
    session = lib.core.get_current_session(kwargs.get("session", None))

    return lib.management.deploy_schema(
        session=session,
        schema_project_path=schema_project_path,
        version=version,
        backup_directory=backup_directory)
