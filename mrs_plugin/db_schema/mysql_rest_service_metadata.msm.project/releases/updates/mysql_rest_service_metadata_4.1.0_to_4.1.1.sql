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
-- from version 4.1.0 to 4.1.1
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

DELIMITER %%

/*
-- ToDo: Add schema objects create statements

-- -----------------------------------------------------------------------------
-- VIEW `mysql_rest_service_metadata`.`my_view`
-- -----------------------------------------------------------------------------

CREATE OR REPLACE VIEW `mysql_rest_service_metadata`.`my_view` AS
    SELECT t.`id`, t.`name`
    FROM `mysql_rest_service_metadata`.`my_table` AS t
    ORDER BY t.`name`%%

-- -----------------------------------------------------------------------------
-- PROCEDURE `mysql_rest_service_metadata`.`my_proc`
-- -----------------------------------------------------------------------------

DROP PROCEDURE IF EXISTS `mysql_rest_service_metadata`.`my_proc`%%
CREATE PROCEDURE `mysql_rest_service_metadata`.`my_proc`(INOUT value INT)
BEGIN
    SET value = value + 1;
END%%
*/

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
SELECT 4, 1, 1;


-- #############################################################################
-- MSM Section 920: Server Variable Restoration
-- -----------------------------------------------------------------------------
-- Restore the modified server variables to their original state.
-- #############################################################################

SET SQL_MODE=@OLD_SQL_MODE;
SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS;
SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS;
