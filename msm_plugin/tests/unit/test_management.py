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

import os
from pathlib import Path
import tempfile
import shutil
import pytest
from msm_plugin.management import *

SCHEMA_NAME = "my_schema"
COPYRIGHT_HOLDER = "Oracle and/or its affiliates."

MSM_SECTION_140_SQL_CONTENT_001 = """
CREATE TABLE `my_schema`.`my_1st_table`(
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `name1` VARCHAR(255)
);"""

MSM_SECTION_140_SQL_CONTENT_002 = """
CREATE TABLE `my_schema`.`my_2nd_table`(
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `name2` VARCHAR(255)
);
"""

MSM_SECTION_150_SQL_CONTENT_002 = r"""
DELIMITER %%

DROP PROCEDURE IF EXISTS `my_schema`.`my_1st_proc`%%
CREATE PROCEDURE `my_schema`.`my_1st_proc`(INOUT val INT)
BEGIN
    SET val = val + 1;
END%%

DELIMITER ;
"""

MSM_SECTION_140_SQL_CONTENT_003 = """
CREATE TABLE `my_schema`.`my_3nd_table`(
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `name3` VARCHAR(255)
);
"""


def test_msm_sections():
    tests_folder = Path(__file__).parent.parent

    with tempfile.TemporaryDirectory() as temp_dir:
        sql_file_path = os.path.join(temp_dir, "my_schema_next.sql")
        shutil.copyfile(os.path.join(
            tests_folder, "my_schema.msm.project", "development", "my_schema_next.sql"),
            sql_file_path)

        sql_content = get_sql_content_from_section(
            file_path=sql_file_path,
            section_id="140"
        )

        assert sql_content == MSM_SECTION_140_SQL_CONTENT_001.strip()

        set_section_sql_content(
            file_path=sql_file_path,
            section_id="140",
            sql_content=(
                MSM_SECTION_140_SQL_CONTENT_001 + "\n"
                + MSM_SECTION_140_SQL_CONTENT_002))

        sql_content = get_sql_content_from_section(
            file_path=sql_file_path,
            section_id="140"
        )

        assert sql_content == (MSM_SECTION_140_SQL_CONTENT_001 + "\n"
                               + MSM_SECTION_140_SQL_CONTENT_002).strip()


def test_create_new_project_folder():
    with tempfile.TemporaryDirectory() as temp_dir:
        # temp_dir = os.path.join(os.path.expanduser("~"), "Documents", "temp")

        project_path = create_new_project_folder(
            schema_name=SCHEMA_NAME,
            target_path=temp_dir,
            copyright_holder=COPYRIGHT_HOLDER
        )

        assert os.path.exists(project_path)

        assert os.path.exists(os.path.join(project_path, "README.md"))
        assert os.path.exists(os.path.join(project_path, "msm.project.json"))

        project_settings = get_project_settings(
            schema_project_path=project_path)
        assert project_settings.get(
            "copyrightHolder", None) == COPYRIGHT_HOLDER

        project_info = get_project_information(
            schema_project_path=project_path)

        current_dev_version = project_info.get(
            "currentDevelopmentVersion", None)
        assert current_dev_version == "0.0.1"


def test_set_development_version():
    with tempfile.TemporaryDirectory() as temp_dir:
        # temp_dir = os.path.join(os.path.expanduser("~"), "Documents", "temp")

        project_path = create_new_project_folder(
            schema_name=SCHEMA_NAME,
            target_path=temp_dir,
            copyright_holder=COPYRIGHT_HOLDER
        )

        # Set the development version to 0.0.2
        set_development_version(
            schema_project_path=project_path, version="0.0.2")
        project_info = get_project_information(
            schema_project_path=project_path)
        current_dev_version = project_info.get(
            "currentDevelopmentVersion", None)
        assert current_dev_version == "0.0.2"

        # Set the development version back to 0.0.1
        set_development_version(
            schema_project_path=project_path, version="0.0.1")
        project_info = get_project_information(
            schema_project_path=project_path)
        current_dev_version = project_info.get(
            "currentDevelopmentVersion", None)
        assert current_dev_version == "0.0.1"

        # Check that there are no released versions
        released_version = get_released_versions(
            schema_project_path=project_path)
        assert len(released_version) == 0


def test_prepare_release(sandbox_session, project_path):
    # Since the project has just been created, there is no deployment script yet
    with pytest.raises(Exception):
        generate_deployment_script(schema_project_path=project_path)

    # ----------------------------------------------------------------------
    # Write some SQL to the development/my_schema_next.sql file
    dev_sql_file_path = os.path.join(
        project_path, "development", "my_schema_next.sql")
    set_section_sql_content(
        file_path=dev_sql_file_path,
        section_id="140",
        sql_content=MSM_SECTION_140_SQL_CONTENT_001)

    files_for_release = prepare_release(
        schema_project_path=project_path,
        version="0.0.1",
        next_version="0.0.2")

    # Since this is the first release, there will only be the versions/my_schema_0.0.1.sql file
    # and no updates file
    assert len(files_for_release) == 1

    released_version = get_released_versions(
        schema_project_path=project_path)
    assert len(released_version) == 1

    last_released_version = get_last_released_version(
        schema_project_path=project_path)
    assert last_released_version == [0, 0, 1]

    # Check if the content of the version SQL file has the right content
    version_sql_file_path = os.path.join(
        project_path, "releases", "versions", "my_schema_0.0.1.sql")
    sql_content_001 = get_sql_content_from_section(
        file_path=dev_sql_file_path,
        section_id="140"
    )
    assert sql_content_001 == MSM_SECTION_140_SQL_CONTENT_001.strip()

    # Generate deployment script
    deployment_sql_file_path = generate_deployment_script(
        schema_project_path=project_path)

    # Check if the schema and the table have been created
    assert sandbox_session is not None

    lib.core.execute_msm_sql_script(
        session=sandbox_session,
        sql_file_path=deployment_sql_file_path)

    assert (lib.core.MsmDbExec(
        'SELECT COUNT(*) as schema_count FROM information_schema.SCHEMATA '
        'WHERE SCHEMA_NAME = ?')
        .exec(sandbox_session, [SCHEMA_NAME])
        .first["schema_count"]) == 1

    assert (lib.core.MsmDbExec(
        'SELECT COUNT(*) as table_count FROM information_schema.TABLES '
        'WHERE TABLE_SCHEMA = ? AND TABLE_TYPE = ?')
        .exec(sandbox_session, [SCHEMA_NAME, "BASE TABLE"])
        .first["table_count"]) == 1

    assert (lib.core.MsmDbExec(
        'SELECT COUNT(*) as table_count FROM information_schema.TABLES '
        'WHERE TABLE_SCHEMA = ? AND TABLE_TYPE = ?')
        .exec(sandbox_session, [SCHEMA_NAME, "VIEW"])
        .first["table_count"]) == 1

    # ----------------------------------------------------------------------
    # Add more SQL to the development/my_schema_next.sql file

    # Add another table
    sql_content_dev = get_sql_content_from_section(
        file_path=dev_sql_file_path,
        section_id="140"
    )
    sql_content_dev_140 = (
        sql_content_dev + "\n"
        + MSM_SECTION_140_SQL_CONTENT_002)
    set_section_sql_content(
        file_path=dev_sql_file_path,
        section_id="140",
        sql_content=sql_content_dev_140)

    # Add a stored procedure
    sql_content_dev = get_sql_content_from_section(
        file_path=dev_sql_file_path,
        section_id="150"
    )
    set_section_sql_content(
        file_path=dev_sql_file_path,
        section_id="150",
        sql_content=MSM_SECTION_150_SQL_CONTENT_002)

    # Prepare 0.0.2 release
    prepare_release(
        schema_project_path=project_path,
        version="0.0.2",
        next_version="0.0.3")

    # Check the content of the versions/0.0.2 SQL file section 140
    version_sql_file_path = os.path.join(
        project_path, "releases", "versions", "my_schema_0.0.2.sql")
    sql_content_002 = get_sql_content_from_section(
        file_path=version_sql_file_path,
        section_id="140"
    )
    assert sql_content_002 == sql_content_dev_140.strip()

    # Set the upgrade code in the 0.0.1 to 0.0.2 update file
    update_sql_file_path = os.path.join(
        project_path, "releases", "updates", "my_schema_0.0.1_to_0.0.2.sql")
    set_section_sql_content(
        file_path=update_sql_file_path,
        section_id="240",
        sql_content=MSM_SECTION_140_SQL_CONTENT_002)

    update_sql_file_path = os.path.join(
        project_path, "releases", "updates", "my_schema_0.0.1_to_0.0.2.sql")
    set_section_sql_content(
        file_path=update_sql_file_path,
        section_id="250",
        sql_content=MSM_SECTION_150_SQL_CONTENT_002)

    # Generate deployment script
    deployment_sql_file_path = generate_deployment_script(
        schema_project_path=project_path)

    # Run deployment script
    lib.core.execute_msm_sql_script(
        session=sandbox_session,
        sql_file_path=deployment_sql_file_path)

    # Check that there are now two tables
    assert (lib.core.MsmDbExec(
        'SELECT COUNT(*) as table_count FROM information_schema.TABLES '
        'WHERE TABLE_SCHEMA = ? AND TABLE_TYPE = ?')
        .exec(sandbox_session, [SCHEMA_NAME, "BASE TABLE"])
        .first["table_count"]) == 2

    assert (lib.core.MsmDbExec(
        'SELECT COUNT(*) as table_count FROM information_schema.TABLES '
        'WHERE TABLE_SCHEMA = ? AND TABLE_TYPE = ?')
        .exec(sandbox_session, [SCHEMA_NAME, "VIEW"])
        .first["table_count"]) == 1

    assert (lib.core.MsmDbExec(
        'SELECT COUNT(*) as proc_count FROM information_schema.ROUTINES '
        'WHERE ROUTINE_SCHEMA = ? AND ROUTINE_TYPE = ?')
        .exec(sandbox_session, [SCHEMA_NAME, "PROCEDURE"])
        .first["proc_count"]) == 1

    # ----------------------------------------------------------------------
    # Prepare 0.0.3 Release

    # Add more SQL to the development/my_schema_next.sql file
    sql_content_dev = get_sql_content_from_section(
        file_path=dev_sql_file_path,
        section_id="140"
    )
    sql_content_dev = (
        sql_content_dev + "\n" + MSM_SECTION_140_SQL_CONTENT_003)

    set_section_sql_content(
        file_path=dev_sql_file_path,
        section_id="140",
        sql_content=sql_content_dev)

    # Prepare the 0.0.3 release
    prepare_release(
        schema_project_path=project_path,
        version="0.0.3",
        next_version="0.0.4")

    # Set the upgrade code in the 0.0.2 to 0.0.3 update file
    update_sql_file_path = os.path.join(
        project_path, "releases", "updates", "my_schema_0.0.2_to_0.0.3.sql")
    set_section_sql_content(
        file_path=update_sql_file_path,
        section_id="240",
        sql_content=MSM_SECTION_140_SQL_CONTENT_003)

    # Generate deployment script
    deployment_sql_file_path = generate_deployment_script(
        schema_project_path=project_path)

    # Run deployment script
    lib.core.execute_msm_sql_script(
        session=sandbox_session,
        sql_file_path=deployment_sql_file_path)

    # Check that there are now two tables
    assert (lib.core.MsmDbExec(
        'SELECT COUNT(*) as table_count FROM information_schema.TABLES '
        'WHERE TABLE_SCHEMA = ? AND TABLE_TYPE = ?')
        .exec(sandbox_session, [SCHEMA_NAME, "BASE TABLE"])
        .first["table_count"]) == 3

    assert (lib.core.MsmDbExec(
        'SELECT COUNT(*) as table_count FROM information_schema.TABLES '
        'WHERE TABLE_SCHEMA = ? AND TABLE_TYPE = ?')
        .exec(sandbox_session, [SCHEMA_NAME, "VIEW"])
        .first["table_count"]) == 1


def test_deployment(sandbox_session, project_path):
    # Ensure to start fresh
    lib.core.MsmDbExec(
        f"DROP SCHEMA IF EXISTS {lib.core.quote_ident(SCHEMA_NAME)}"
    ).exec(sandbox_session)

    # Deploy all released versions after each other to test update capability
    released_versions = get_released_versions(schema_project_path=project_path)

    assert len(released_versions) > 0

    version_str = '%d.%d.%d' % tuple(released_versions[0])
    result_msg = deploy_schema(
        schema_project_path=project_path, version=version_str)

    assert result_msg == (
        f"Completed the deployment of `{SCHEMA_NAME}` version "
        f"{version_str} successfully.")


    assert len(released_versions) > 1

    version_str_next = '%d.%d.%d' % tuple(released_versions[1])
    result_msg = deploy_schema(
        schema_project_path=project_path, version=version_str_next)

    assert result_msg == (
        f"Completed the update of `{SCHEMA_NAME}` version "
        f"{version_str} to {version_str_next} successfully.")

    # for version in released_versions:
    #     version_str = '%d.%d.%d' % tuple(version)
    #     deploy_schema(schema_project_path=project_path, version=version_str)

    #     # Check if the right version has actually been deployed
    #     assert (lib.core.MsmDbExec(
    #         "SELECT CONCAT(major, '.', minor, '.', patch) AS version "
    #         f"FROM {lib.core.quote_ident(SCHEMA_NAME)}.`msm_schema_version`")
    #         .exec(sandbox_session).first["version"]) == version_str
