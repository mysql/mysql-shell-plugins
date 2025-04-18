/*
 * Copyright (c) 2025, Oracle and/or its affiliates.
 *
 * This program is free software; you can redistribute it and/or modify
 * it under the terms of the GNU General Public License, version 2.0,
 * as published by the Free Software Foundation.
 *
 * This program is designed to work with certain software (including
 * but not limited to OpenSSL) that is licensed under separate terms, as
 * designated in a particular file or component or in included license
 * documentation.  The authors of MySQL hereby grant you an additional
 * permission to link the program and your derivative works with the
 * separately licensed software that they have either included with
 * the program or referenced in the documentation.
 *
 * This program is distributed in the hope that it will be useful,  but
 * WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See
 * the GNU General Public License, version 2.0, for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program; if not, write to the Free Software Foundation, Inc.,
 * 51 Franklin St, Fifth Floor, Boston, MA 02110-1301 USA
 */

-- #############################################################################
-- MSM Section 002: Database Schema Update Script
-- -----------------------------------------------------------------------------
-- This script updates the database schema `mysql_rest_service_metadata`
-- from version 4.0.4 to 4.1.0
-- #############################################################################


-- #############################################################################
-- MSM Section 010: Server Variable Settings
-- -----------------------------------------------------------------------------
-- Set server variables, remember their state to be able to restore accordingly.
-- #############################################################################

SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0;
SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0;
SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='ONLY_FULL_GROUP_BY,STRICT_TRANS_TABLES,'
    'NO_ZERO_IN_DATE,NO_ZERO_DATE,ERROR_FOR_DIVISION_BY_ZERO,'
    'NO_ENGINE_SUBSTITUTION';


-- #############################################################################
-- MSM Section 220: Database Schema Version Update Indication
-- -----------------------------------------------------------------------------
-- Replace the `mysql_rest_service_metadata`.`msm_schema_version` VIEW
-- and initialize it with the version 0, 0, 0 which indicates the ongoing
-- update processes of the database schema.
-- #############################################################################

CREATE OR REPLACE SQL SECURITY INVOKER
VIEW `mysql_rest_service_metadata`.`msm_schema_version` (
    `major`,`minor`,`patch`) AS
SELECT 0, 0, 0;


-- #############################################################################
-- MSM Section 230: Creation of Update Helpers
-- -----------------------------------------------------------------------------
-- Definitions of optional helper PROCEDUREs and FUNCTIONs that are called
-- during the update of the database schema. It is important to note that these
-- need to be defined in a way as if a schema object of the same name and type
-- already exists. Use explicit DROP IF EXISTS statements or CREATE OR REPLACE
-- statements when creating the helper objects. The names of all helper
-- routines need to start with `msm_`.
-- #############################################################################

DELIMITER %%

-- Insert optional helper PROCEDUREs and FUNCTIONs here

DELIMITER ;


-- #############################################################################
-- MSM Section 240: Non-idempotent Schema Object Changes and All DROPs
-- -----------------------------------------------------------------------------
-- This section contains changes performed on schema TABLEs. It is important to
-- note that these changes need to be carefully processed during a schema
-- upgrade operation. These changes must be executed in the right order as
-- each operation will result in a state change that often cannot be easily
-- revered. This might include DROP statements on other schema objects (VIEWs,
-- PROCEDUREs, FUNCTIONs, TRIGGERs EVENTs, ...) as they could otherwise prevent
-- change of the TABLE structure. These schema objects may then be re-created
-- inside the MSM Section 250: Idempotent Schema Object Changes. If there are
-- no changes required, this section can be skipped.
-- -----------------------------------------------------------------------------
-- TABLE changes and all DROP statements
-- #############################################################################

/*
-- ToDo: Add ALTER TABLE statements or new CREATE TABLE statements. Include
-- DROP TRIGGER/EVENT/... statements and re-create them in the next section.
-- Perform DML statements if needed.

-- -----------------------------------------------------------------------------
-- ALTER TABLE `mysql_rest_service_metadata`.`my_table`
-- -----------------------------------------------------------------------------

ALTER TABLE `mysql_rest_service_metadata`.`my_table`
    ADD COLUMN birthday DATE;
*/


-- #############################################################################
-- MSM Section 250: Idempotent Schema Object Additions And Changes
-- -----------------------------------------------------------------------------
-- This section contains the new and update creation of all schema objects,
-- except TABLEs, ROLEs and GRANTs. Ensure that all existing objects are
-- overwritten in a clean manner using explicit DROP IF EXISTS statements or
-- CREATE OR REPLACE when re-creating the objects. All object removals must
-- be defined in the MSM Section 240. If there are no changes required, this
-- section can be skipped.
-- -----------------------------------------------------------------------------
-- All other schema object definitions (VIEWs, PROCEDUREs, FUNCTIONs, TRIGGERs,
-- EVENTs, ...) that are new or have changed
-- #############################################################################

-- -----------------------------------------------------------------------------
-- CREATE PROCEDURE `mysql_rest_service_metadata`.`restore_roles`
-- -----------------------------------------------------------------------------

DROP PROCEDURE IF EXISTS `mysql_rest_service_metadata`.`restore_roles`%%
CREATE PROCEDURE `mysql_rest_service_metadata`.`restore_roles`()
SQL SECURITY DEFINER
COMMENT 'This procedure restores all the ROLEs required by the MySQL REST Service.'
BEGIN
    -- -----------------------------------------------------
    -- Create roles for the MySQL REST Service

    -- The mysql_rest_service_admin ROLE allows to fully manage the REST services
    -- The mysql_rest_service_schema_admin ROLE allows to manage the database schemas assigned to REST services
    -- The mysql_rest_service_dev ROLE allows to develop new REST objects for given REST services and upload static files
    -- The mysql_rest_service_user ROLE can be assigned to MySQL users that are granted access via MySQL Internal authentication.
    -- The mysql_rest_service_meta_provider ROLE is used by the MySQL Router to read the mrs metadata and make inserts into the auth_user table
    -- The mysql_rest_service_data_provider ROLE is used by the MySQL Router to read the actual schema data that is exposed via REST

    CREATE ROLE IF NOT EXISTS 'mysql_rest_service_admin', 'mysql_rest_service_schema_admin', 'mysql_rest_service_dev', 'mysql_rest_service_user',
        'mysql_rest_service_meta_provider', 'mysql_rest_service_data_provider';

    -- Allow the 'mysql_rest_service_user' role to access the same data as 'mysql_rest_service_data_provider'
    GRANT 'mysql_rest_service_data_provider' TO 'mysql_rest_service_user';

    -- Allow the creation of temporary tables
    GRANT CREATE TEMPORARY TABLES ON `mysql_rest_service_metadata`.*
        TO 'mysql_rest_service_data_provider';

    -- `mysql_rest_service_metadata`.`msm_schema_version`
    GRANT SELECT ON `mysql_rest_service_metadata`.`msm_schema_version`
        TO 'mysql_rest_service_admin', 'mysql_rest_service_schema_admin', 'mysql_rest_service_dev', 'mysql_rest_service_meta_provider';

    -- `mysql_rest_service_metadata`.`audit_log`
    GRANT SELECT ON `mysql_rest_service_metadata`.`audit_log`
        TO 'mysql_rest_service_admin', 'mysql_rest_service_schema_admin', 'mysql_rest_service_dev', 'mysql_rest_service_meta_provider';

    -- -----------------------------------------------------
    -- Config

    -- `mysql_rest_service_metadata`.`config`
    GRANT SELECT, UPDATE
        ON `mysql_rest_service_metadata`.`config`
        TO 'mysql_rest_service_admin', 'mysql_rest_service_schema_admin';
    GRANT SELECT ON `mysql_rest_service_metadata`.`config`
        TO 'mysql_rest_service_meta_provider', 'mysql_rest_service_dev';

    -- `mysql_rest_service_metadata`.`redirect`
    GRANT SELECT, INSERT, UPDATE, DELETE
        ON `mysql_rest_service_metadata`.`redirect`
        TO 'mysql_rest_service_admin';
    GRANT SELECT ON `mysql_rest_service_metadata`.`redirect`
        TO 'mysql_rest_service_schema_admin', 'mysql_rest_service_dev', 'mysql_rest_service_meta_provider';

    -- -----------------------------------------------------
    -- Service

    -- `mysql_rest_service_metadata`.`url_host`
    GRANT SELECT, INSERT, UPDATE, DELETE
        ON `mysql_rest_service_metadata`.`url_host`
        TO 'mysql_rest_service_admin';
    GRANT SELECT ON `mysql_rest_service_metadata`.`url_host`
        TO 'mysql_rest_service_schema_admin', 'mysql_rest_service_dev', 'mysql_rest_service_meta_provider';

    -- `mysql_rest_service_metadata`.`url_host_alias`
    GRANT SELECT, INSERT, DELETE
        ON `mysql_rest_service_metadata`.`url_host_alias`
        TO 'mysql_rest_service_admin';
    GRANT SELECT ON `mysql_rest_service_metadata`.`url_host_alias`
        TO 'mysql_rest_service_schema_admin', 'mysql_rest_service_dev', 'mysql_rest_service_meta_provider';

    -- `mysql_rest_service_metadata`.`service`
    GRANT SELECT, INSERT, UPDATE, DELETE
        ON `mysql_rest_service_metadata`.`service`
        TO 'mysql_rest_service_admin';
    GRANT SELECT ON `mysql_rest_service_metadata`.`service`
        TO 'mysql_rest_service_schema_admin', 'mysql_rest_service_dev', 'mysql_rest_service_meta_provider';

    -- -----------------------------------------------------
    -- Schema Objects

    -- `mysql_rest_service_metadata`.`db_schema`
    GRANT SELECT, INSERT, UPDATE, DELETE
        ON `mysql_rest_service_metadata`.`db_schema`
        TO 'mysql_rest_service_admin', 'mysql_rest_service_schema_admin';
    GRANT SELECT ON `mysql_rest_service_metadata`.`db_schema`
        TO 'mysql_rest_service_meta_provider', 'mysql_rest_service_dev';

    -- `mysql_rest_service_metadata`.`db_object`
    GRANT SELECT, INSERT, UPDATE, DELETE
        ON `mysql_rest_service_metadata`.`db_object`
        TO 'mysql_rest_service_admin', 'mysql_rest_service_schema_admin', 'mysql_rest_service_dev';
    GRANT SELECT ON `mysql_rest_service_metadata`.`db_object`
        TO 'mysql_rest_service_meta_provider';

    -- `mysql_rest_service_metadata`.`mrs_db_object_row_group_security`
    GRANT SELECT, INSERT, UPDATE, DELETE
        ON `mysql_rest_service_metadata`.`mrs_db_object_row_group_security`
        TO 'mysql_rest_service_admin', 'mysql_rest_service_schema_admin', 'mysql_rest_service_dev';
    GRANT SELECT ON `mysql_rest_service_metadata`.`mrs_db_object_row_group_security`
        TO 'mysql_rest_service_meta_provider';

    -- `mysql_rest_service_metadata`.`object`
    GRANT SELECT, INSERT, UPDATE, DELETE
        ON `mysql_rest_service_metadata`.`object`
        TO 'mysql_rest_service_admin', 'mysql_rest_service_schema_admin', 'mysql_rest_service_dev';
    GRANT SELECT ON `mysql_rest_service_metadata`.`object`
        TO 'mysql_rest_service_meta_provider';

    -- `mysql_rest_service_metadata`.`object_field`
    GRANT SELECT, INSERT, UPDATE, DELETE
        ON `mysql_rest_service_metadata`.`object_field`
        TO 'mysql_rest_service_admin', 'mysql_rest_service_schema_admin', 'mysql_rest_service_dev';
    GRANT SELECT ON `mysql_rest_service_metadata`.`object_field`
        TO 'mysql_rest_service_meta_provider';

    -- `mysql_rest_service_metadata`.`object_reference`
    GRANT SELECT, INSERT, UPDATE, DELETE
        ON `mysql_rest_service_metadata`.`object_reference`
        TO 'mysql_rest_service_admin', 'mysql_rest_service_schema_admin', 'mysql_rest_service_dev';
    GRANT SELECT ON `mysql_rest_service_metadata`.`object_reference`
        TO 'mysql_rest_service_meta_provider';

    -- -----------------------------------------------------
    -- Static Content

    -- `mysql_rest_service_metadata`.`content_set`
    GRANT SELECT, INSERT, UPDATE, DELETE
        ON `mysql_rest_service_metadata`.`content_set`
        TO 'mysql_rest_service_admin', 'mysql_rest_service_schema_admin', 'mysql_rest_service_dev';
    GRANT SELECT ON `mysql_rest_service_metadata`.`content_set`
        TO 'mysql_rest_service_meta_provider';

    -- `mysql_rest_service_metadata`.`content_file`
    GRANT SELECT, INSERT, UPDATE, DELETE
        ON `mysql_rest_service_metadata`.`content_file`
        TO 'mysql_rest_service_admin', 'mysql_rest_service_schema_admin', 'mysql_rest_service_dev';
    GRANT SELECT ON `mysql_rest_service_metadata`.`content_file`
        TO 'mysql_rest_service_meta_provider';


    -- `mysql_rest_service_metadata`.`content_set_has_obj_def`
    GRANT SELECT, INSERT, UPDATE, DELETE
        ON `mysql_rest_service_metadata`.`content_set_has_obj_def`
        TO 'mysql_rest_service_admin', 'mysql_rest_service_schema_admin', 'mysql_rest_service_dev';
    GRANT SELECT ON `mysql_rest_service_metadata`.`content_set_has_obj_def`
        TO 'mysql_rest_service_meta_provider';

    -- -----------------------------------------------------
    -- User Authentication

    -- `mysql_rest_service_metadata`.`auth_app`
    GRANT SELECT, INSERT, UPDATE, DELETE
        ON `mysql_rest_service_metadata`.`auth_app`
        TO 'mysql_rest_service_admin';
    GRANT SELECT ON `mysql_rest_service_metadata`.`auth_app`
        TO 'mysql_rest_service_meta_provider', 'mysql_rest_service_schema_admin', 'mysql_rest_service_dev';

    -- `mysql_rest_service_metadata`.`service_has_auth_app`
    GRANT SELECT, INSERT, UPDATE, DELETE
        ON `mysql_rest_service_metadata`.`service_has_auth_app`
        TO 'mysql_rest_service_admin';
    GRANT SELECT ON `mysql_rest_service_metadata`.`service_has_auth_app`
        TO 'mysql_rest_service_meta_provider', 'mysql_rest_service_schema_admin', 'mysql_rest_service_dev';

    -- `mysql_rest_service_metadata`.`auth_vendor`
    GRANT SELECT, INSERT, UPDATE, DELETE
        ON `mysql_rest_service_metadata`.`auth_vendor`
        TO 'mysql_rest_service_admin';
    GRANT SELECT ON `mysql_rest_service_metadata`.`auth_vendor`
        TO 'mysql_rest_service_meta_provider', 'mysql_rest_service_schema_admin', 'mysql_rest_service_dev';

    -- `mysql_rest_service_metadata`.`mrs_user`
    GRANT SELECT, INSERT, UPDATE, DELETE
        ON `mysql_rest_service_metadata`.`mrs_user`
        TO 'mysql_rest_service_admin';
    GRANT SELECT, INSERT, UPDATE ON `mysql_rest_service_metadata`.`mrs_user`
        TO 'mysql_rest_service_meta_provider';
    GRANT SELECT ON `mysql_rest_service_metadata`.`mrs_user`
        TO 'mysql_rest_service_data_provider';

    -- -----------------------------------------------------
    -- User Hierarchy

    -- `mysql_rest_service_metadata`.`mrs_user_hierarchy`
    GRANT SELECT, INSERT, UPDATE, DELETE
        ON `mysql_rest_service_metadata`.`mrs_user_hierarchy`
        TO 'mysql_rest_service_admin';
    GRANT SELECT, INSERT ON `mysql_rest_service_metadata`.`mrs_user_hierarchy`
        TO 'mysql_rest_service_meta_provider';
    GRANT SELECT ON `mysql_rest_service_metadata`.`mrs_user_hierarchy`
        TO 'mysql_rest_service_data_provider';

    -- `mysql_rest_service_metadata`.`mrs_user_hierarchy_type`
    GRANT SELECT, INSERT, UPDATE, DELETE
        ON `mysql_rest_service_metadata`.`mrs_user_hierarchy_type`
        TO 'mysql_rest_service_admin';
    GRANT SELECT, INSERT ON `mysql_rest_service_metadata`.`mrs_user_hierarchy_type`
        TO 'mysql_rest_service_meta_provider';

    -- -----------------------------------------------------
    -- User Roles

    -- `mysql_rest_service_metadata`.`mrs_user_has_role`
    GRANT SELECT, INSERT, UPDATE, DELETE
        ON `mysql_rest_service_metadata`.`mrs_user_has_role`
        TO 'mysql_rest_service_admin';
    GRANT SELECT, INSERT ON `mysql_rest_service_metadata`.`mrs_user_has_role`
        TO 'mysql_rest_service_meta_provider';

    -- `mysql_rest_service_metadata`.`mrs_role`
    GRANT SELECT, INSERT, UPDATE, DELETE
        ON `mysql_rest_service_metadata`.`mrs_role`
        TO 'mysql_rest_service_admin';
    GRANT SELECT, INSERT ON `mysql_rest_service_metadata`.`mrs_role`
        TO 'mysql_rest_service_meta_provider';

    -- `mysql_rest_service_metadata`.`mrs_privilege`
    GRANT SELECT, INSERT, UPDATE, DELETE
        ON `mysql_rest_service_metadata`.`mrs_privilege`
        TO 'mysql_rest_service_admin';
    GRANT SELECT, INSERT ON `mysql_rest_service_metadata`.`mrs_privilege`
        TO 'mysql_rest_service_meta_provider';

    -- -----------------------------------------------------
    -- User Group Management

    -- `mysql_rest_service_metadata`.`mrs_user_has_group`
    GRANT SELECT, INSERT, UPDATE, DELETE
        ON `mysql_rest_service_metadata`.`mrs_user_has_group`
        TO 'mysql_rest_service_admin';
    GRANT SELECT, INSERT ON `mysql_rest_service_metadata`.`mrs_user_has_group`
        TO 'mysql_rest_service_meta_provider';

    -- `mysql_rest_service_metadata`.`mrs_user_group`
    GRANT SELECT, INSERT, UPDATE, DELETE
        ON `mysql_rest_service_metadata`.`mrs_user_group`
        TO 'mysql_rest_service_admin';
    GRANT SELECT, INSERT ON `mysql_rest_service_metadata`.`mrs_user_group`
        TO 'mysql_rest_service_meta_provider';

    -- `mysql_rest_service_metadata`.`mrs_user_group_has_role`
    GRANT SELECT, INSERT, UPDATE, DELETE
        ON `mysql_rest_service_metadata`.`mrs_user_group_has_role`
        TO 'mysql_rest_service_admin';
    GRANT SELECT, INSERT ON `mysql_rest_service_metadata`.`mrs_user_group_has_role`
        TO 'mysql_rest_service_meta_provider';

    -- `mysql_rest_service_metadata`.`mrs_group_hierarchy_type`
    GRANT SELECT, INSERT, UPDATE, DELETE
        ON `mysql_rest_service_metadata`.`mrs_group_hierarchy_type`
        TO 'mysql_rest_service_admin';
    GRANT SELECT, INSERT ON `mysql_rest_service_metadata`.`mrs_group_hierarchy_type`
        TO 'mysql_rest_service_meta_provider';

    -- `mysql_rest_service_metadata`.`mrs_user_group_hierarchy`
    GRANT SELECT, INSERT, UPDATE, DELETE
        ON `mysql_rest_service_metadata`.`mrs_user_group_hierarchy`
        TO 'mysql_rest_service_admin';
    GRANT SELECT, INSERT ON `mysql_rest_service_metadata`.`mrs_user_group_hierarchy`
        TO 'mysql_rest_service_meta_provider';
    GRANT SELECT ON `mysql_rest_service_metadata`.`mrs_user_group_hierarchy`
        TO 'mysql_rest_service_data_provider';

    -- -----------------------------------------------------
    -- Router Management

    -- `mysql_rest_service_metadata`.`router`
    GRANT SELECT, INSERT, UPDATE, DELETE
        ON `mysql_rest_service_metadata`.`router`
        TO 'mysql_rest_service_admin';
    GRANT SELECT, INSERT, UPDATE ON `mysql_rest_service_metadata`.`router`
        TO 'mysql_rest_service_meta_provider';
    GRANT SELECT
        ON `mysql_rest_service_metadata`.`router`
        TO 'mysql_rest_service_schema_admin', 'mysql_rest_service_dev';

    -- `mysql_rest_service_metadata`.`router_status`
    GRANT SELECT, INSERT, UPDATE, DELETE
        ON `mysql_rest_service_metadata`.`router_status`
        TO 'mysql_rest_service_admin';
    GRANT SELECT, INSERT, UPDATE ON `mysql_rest_service_metadata`.`router_status`
        TO 'mysql_rest_service_meta_provider';
    GRANT SELECT ON `mysql_rest_service_metadata`.`router_status`
        TO 'mysql_rest_service_schema_admin', 'mysql_rest_service_dev';

    -- `mysql_rest_service_metadata`.`router_general_log`
    GRANT SELECT, INSERT, UPDATE, DELETE
        ON `mysql_rest_service_metadata`.`router_general_log`
        TO 'mysql_rest_service_admin';
    GRANT INSERT ON `mysql_rest_service_metadata`.`router_general_log`
        TO 'mysql_rest_service_meta_provider';
    GRANT SELECT ON `mysql_rest_service_metadata`.`router_general_log`
        TO 'mysql_rest_service_schema_admin', 'mysql_rest_service_dev';

    -- `mysql_rest_service_metadata`.`router_session`
    GRANT SELECT, INSERT, UPDATE, DELETE
        ON `mysql_rest_service_metadata`.`router_session`
        TO 'mysql_rest_service_admin';
    GRANT SELECT, INSERT ON `mysql_rest_service_metadata`.`router_session`
        TO 'mysql_rest_service_meta_provider';
    GRANT SELECT ON `mysql_rest_service_metadata`.`router_session`
        TO 'mysql_rest_service_schema_admin', 'mysql_rest_service_dev';

    -- `mysql_rest_service_metadata`.`router_services`
    GRANT SELECT ON `mysql_rest_service_metadata`.`router_services`
        TO 'mysql_rest_service_admin', 'mysql_rest_service_schema_admin', 'mysql_rest_service_dev', 'mysql_rest_service_meta_provider';

    -- -----------------------------------------------------
    -- Procedures

    -- `mysql_rest_service_metadata`.`get_sequence_id`

    GRANT EXECUTE ON FUNCTION `mysql_rest_service_metadata`.`get_sequence_id`
        TO 'mysql_rest_service_admin', 'mysql_rest_service_schema_admin', 'mysql_rest_service_dev', 'mysql_rest_service_meta_provider', 'mysql_rest_service_data_provider';

    -- `mysql_rest_service_metadata`.`table_columns_with_references`
    GRANT EXECUTE
        ON PROCEDURE `mysql_rest_service_metadata`.`table_columns_with_references`
        TO 'mysql_rest_service_admin', 'mysql_rest_service_schema_admin', 'mysql_rest_service_dev', 'mysql_rest_service_meta_provider';


    -- -----------------------------------------------------
    -- Views

    -- `mysql_rest_service_metadata`.`mrs_user_schema_version`
    GRANT SELECT
      ON `mysql_rest_service_metadata`.`mrs_user_schema_version`
      TO 'mysql_rest_service_admin', 'mysql_rest_service_schema_admin', 'mysql_rest_service_dev', 'mysql_rest_service_meta_provider';

    -- `mysql_rest_service_metadata`.`object_fields_with_references`
    GRANT SELECT
        ON `mysql_rest_service_metadata`.`object_fields_with_references`
        TO 'mysql_rest_service_admin', 'mysql_rest_service_schema_admin', 'mysql_rest_service_dev', 'mysql_rest_service_meta_provider';

    -- -----------------------------------------------------
    -- Grant the necessary mysql_tasks privileges to the MySQL REST Service roles
    GRANT 'mysql_task_user' TO 'mysql_rest_service_admin', 'mysql_rest_service_schema_admin', 'mysql_rest_service_dev', 'mysql_rest_service_user',
    	'mysql_rest_service_meta_provider', 'mysql_rest_service_data_provider';

END%%

DELIMITER ;


-- #############################################################################
-- MSM Section 270: Authorization
-- -----------------------------------------------------------------------------
-- This section is used to define changes for ROLEs and GRANTs in respect to
-- the previous version. If there are no changes required, this section can
-- be skipped.
-- #############################################################################

-- Change ROLEs and perform the required GRANT/REVOKE statements.


-- #############################################################################
-- MSM Section 290: Removal of Update Helpers
-- -----------------------------------------------------------------------------
-- Removal of optional helper PROCEDUREs and FUNCTIONs that are called during
-- the update of the database schema. Note that DROP IF EXISTS needs to be
-- used.
-- #############################################################################

-- Drop optional helper PROCEDUREs and FUNCTIONs here.


-- #############################################################################
-- MSM Section 910: Database Schema Version Definition
-- -----------------------------------------------------------------------------
-- Setting the correct database schema version.
-- #############################################################################

CREATE OR REPLACE SQL SECURITY INVOKER
VIEW `mysql_rest_service_metadata`.`msm_schema_version` (
    `major`,`minor`,`patch`) AS
SELECT 4, 1, 0;


-- #############################################################################
-- MSM Section 920: Server Variable Restoration
-- -----------------------------------------------------------------------------
-- Restore the modified server variables to their original state.
-- #############################################################################

SET SQL_MODE=@OLD_SQL_MODE;
SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS;
SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS;
