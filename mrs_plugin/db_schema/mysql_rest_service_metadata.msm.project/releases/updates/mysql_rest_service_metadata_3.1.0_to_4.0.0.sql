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
-- This script updates the `mysql_rest_service_metadata` database schema from version
-- 3.1.0 to 4.0.0
-- -----------------------------------------------------------------------------


-- #############################################################################
-- MSM Section 010: Server Variable Settings
-- -----------------------------------------------------------------------------
-- Set server variables, remember their state to be able to restore accordingly.
-- -----------------------------------------------------------------------------

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
-- -----------------------------------------------------------------------------

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
-- statements when creating the helper objects.
-- -----------------------------------------------------------------------------

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
-- -----------------------------------------------------------------------------

-- Drop old `schema_version` VIEW as it is replaced by `msm_schema_version`
DROP VIEW IF EXISTS `mysql_rest_service_metadata`.`schema_version`;

-- Apply changes to `mrs_privilege` table
UPDATE `mysql_rest_service_metadata`.`mrs_privilege`
    SET service_path = '*' WHERE service_path IS NULL;

UPDATE `mysql_rest_service_metadata`.`mrs_privilege`
    SET schema_path = '*' WHERE schema_path IS NULL;

UPDATE `mysql_rest_service_metadata`.`mrs_privilege`
    SET object_path = '*' WHERE object_path IS NULL;

ALTER TABLE `mysql_rest_service_metadata`.`mrs_privilege`
    DROP CONSTRAINT `fk_priv_on_schema_db_schema1`,
    DROP CONSTRAINT `fk_priv_on_schema_service1`,
    DROP CONSTRAINT `fk_priv_on_schema_db_object1`;

ALTER TABLE `mysql_rest_service_metadata`.`mrs_privilege`
    DROP COLUMN `service_id`,
    DROP COLUMN `db_schema_id`,
    DROP COLUMN `db_object_id`,
    CHANGE COLUMN `service_path` `service_path` VARCHAR(512) NOT NULL DEFAULT '*',
    CHANGE COLUMN `schema_path` `schema_path` VARCHAR(255) NOT NULL DEFAULT '*',
    CHANGE COLUMN `object_path` `object_path` VARCHAR(255) NOT NULL DEFAULT '*';


-- Ensure an email cannot be used as user name and a user name cannot be used as email
ALTER TABLE `mysql_rest_service_metadata`.`mrs_user`
    ADD INDEX `mrs_user_name` (`name` ASC) VISIBLE,
    ADD INDEX `mrs_user_email` (`email` ASC) VISIBLE,
    ADD CONSTRAINT `mrs_user_no_at_symbol_in_user_name` CHECK (INSTR(name, '@') = 0),
    ADD CONSTRAINT `mrs_user_at_symbol_in_email` CHECK (INSTR(email, '@') > 0 OR email IS NULL OR email = '');

ALTER TABLE `mysql_rest_service_metadata`.`router_status`
      CHANGE COLUMN `timespan` `timespan` INT UNSIGNED NOT NULL COMMENT 'The timespan of the measuring interval',
      CHANGE COLUMN `mysql_connections` `mysql_connections` INT UNSIGNED NOT NULL DEFAULT 0,
      CHANGE COLUMN `mysql_queries` `mysql_queries` INT UNSIGNED NOT NULL DEFAULT 0,
      CHANGE COLUMN `http_requests_get` `http_requests_get` INT UNSIGNED NOT NULL DEFAULT 0,
      CHANGE COLUMN `http_requests_post` `http_requests_post` INT UNSIGNED NOT NULL DEFAULT 0,
      CHANGE COLUMN `http_requests_put` `http_requests_put` INT UNSIGNED NOT NULL DEFAULT 0,
      CHANGE COLUMN `http_requests_delete` `http_requests_delete` INT UNSIGNED NOT NULL DEFAULT 0,
      CHANGE COLUMN `active_mysql_connections` `active_mysql_connections` INT UNSIGNED NOT NULL DEFAULT 0;


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
-- -----------------------------------------------------------------------------

DELIMITER %%

DROP TRIGGER `mysql_rest_service_metadata`.`db_schema_BEFORE_DELETE`%%
CREATE DEFINER = CURRENT_USER TRIGGER `mysql_rest_service_metadata`.`db_schema_BEFORE_DELETE` BEFORE DELETE ON `db_schema` FOR EACH ROW
BEGIN
	DELETE FROM `mysql_rest_service_metadata`.`db_object` WHERE `db_schema_id` = OLD.`id`;
END%%

DROP TRIGGER `mysql_rest_service_metadata`.`db_object_BEFORE_DELETE`%%
CREATE DEFINER = CURRENT_USER TRIGGER `mysql_rest_service_metadata`.`db_object_BEFORE_DELETE` BEFORE DELETE ON `db_object` FOR EACH ROW
BEGIN
    DELETE FROM `mysql_rest_service_metadata`.`mrs_db_object_row_group_security` WHERE `db_object_id` = OLD.`id`;
    DELETE FROM `mysql_rest_service_metadata`.`object` WHERE `db_object_id` = OLD.`id`;
END%%

DELIMITER ;


-- #############################################################################
-- MSM Section 270: Authorization
-- -----------------------------------------------------------------------------
-- This section is used to define changes for ROLEs and GRANTs in respect to
-- the previous version. If there are no changes required, this section can
-- be skipped.
-- -----------------------------------------------------------------------------



-- #############################################################################
-- MSM Section 290: Removal of Update Helpers
-- -----------------------------------------------------------------------------
-- Removal of optional helper PROCEDUREs and FUNCTIONs that are called during
-- the update of the database schema. Note that DROP IF EXISTS needs to be
-- used.
-- -----------------------------------------------------------------------------

-- Drop optional helper PROCEDUREs and FUNCTIONs here.


-- #############################################################################
-- MSM Section 910: Database Schema Version Definition
-- -----------------------------------------------------------------------------
-- Setting the correct database schema version.
-- -----------------------------------------------------------------------------

CREATE OR REPLACE SQL SECURITY INVOKER
VIEW `mysql_rest_service_metadata`.`msm_schema_version` (
    `major`,`minor`,`patch`) AS
SELECT 4, 0, 0;


-- #############################################################################
-- MSM Section 920: Server Variable Restoration
-- -----------------------------------------------------------------------------
-- Restore the modified server variables to their original state.
-- -----------------------------------------------------------------------------

SET SQL_MODE=@OLD_SQL_MODE;
SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS;
SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS;
