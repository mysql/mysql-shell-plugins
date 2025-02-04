-- Copyright (c) 2025, Oracle and/or its affiliates.
${license}
-- #############################################################################
-- MSM Section 000: Database Schema Development Script
-- -----------------------------------------------------------------------------
-- This script contains the current development version of the database schema
-- `${schema_name}`
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
-- MSM Section 110: Database Schema Creation
-- -----------------------------------------------------------------------------
-- CREATE SCHEMA statement.
-- -----------------------------------------------------------------------------

CREATE SCHEMA IF NOT EXISTS `${schema_name}`
    DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;


-- #############################################################################
-- MSM Section 120: Database Schema Version Creation Indication
-- -----------------------------------------------------------------------------
-- Create the `${schema_name}`.`msm_schema_version` VIEW
-- and initialize it with the version 0, 0, 0 which indicates the ongoing
-- creation processes of the database schema.
-- -----------------------------------------------------------------------------

CREATE OR REPLACE SQL SECURITY INVOKER
VIEW `${schema_name}`.`msm_schema_version` (
    `major`,`minor`,`patch`) AS
SELECT 0, 0, 0;


-- #############################################################################
-- MSM Section 130: Creation of Helpers
-- -----------------------------------------------------------------------------
-- Definitions of optional helper PROCEDUREs and FUNCTIONs that are called
-- during the creation of the database schema. The names of all helper routines
-- need to start with `msm_`.
-- -----------------------------------------------------------------------------

DELIMITER %%

-- Insert optional helper PROCEDUREs and FUNCTIONs here

DELIMITER ;


-- #############################################################################
-- MSM Section 140: Non-idempotent Schema Objects
-- -----------------------------------------------------------------------------
-- This section contains creation of schema TABLEs and the initialization of
-- base data (standard INSERTs). It is important to note that all other
-- schema objects (VIEWs, PROCEDUREs, FUNCTIONs, TRIGGERs EVENTs, ...) need to
-- be created inside the MSM Section 150: idempotent schema object changes.
-- ROLEs and GRANTs are defined in the MSM Section 170: Authorization.
-- -----------------------------------------------------------------------------
-- CREATE TABLE statements and standard INSERTs.
-- -----------------------------------------------------------------------------

/*
-- ToDo: Add schema TABLEs create statements

-- -----------------------------------------------------------------------------
-- TABLE `${schema_name}`.`my_table`
-- -----------------------------------------------------------------------------

CREATE TABLE `${schema_name}`.`my_table`(
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `name` VARCHAR(255),
    `options` JSON,
    INDEX `name_index`(`name`(45))
);

INSERT INTO `${schema_name}`.`my_table`(`name`, `options`)
    VALUES ('Standard User', '{"privileges": ["default"]}');
*/


-- #############################################################################
-- MSM Section 150: Idempotent Schema Objects
-- -----------------------------------------------------------------------------
-- This section contains the creation of all schema objects except TABLEs.
-- All objects must be created under the assumption that an object of the same
-- name is already present. Therefore explicit DROP IF EXISTS statements or
-- CREATE OR REPLACE clauses must be used when creating the objects.
-- -----------------------------------------------------------------------------
-- All other schema object definitions (VIEWS, PROCEDUREs, FUNCTIONs, TRIGGERs,
-- EVENTS, ...).
-- -----------------------------------------------------------------------------

DELIMITER %%

/*
-- ToDo: Add schema objects create statements

-- -----------------------------------------------------------------------------
-- VIEW `${schema_name}`.`my_view`
-- -----------------------------------------------------------------------------

CREATE OR REPLACE VIEW `${schema_name}`.`my_view` AS
    SELECT t.`id`, t.`name`
    FROM `${schema_name}`.`my_table` AS t
    ORDER BY t.`name`%%

-- -----------------------------------------------------------------------------
-- PROCEDURE `${schema_name}`.`my_proc`
-- -----------------------------------------------------------------------------

DROP PROCEDURE IF EXISTS `${schema_name}`.`my_proc`%%
CREATE PROCEDURE `${schema_name}`.`my_proc`(INOUT value INT)
BEGIN
    SET value = value + 1;
END%%
*/

DELIMITER ;


-- #############################################################################
-- MSM Section 170: Authorization
-- -----------------------------------------------------------------------------
-- This section is used to define the ROLEs and GRANT statements.
-- -----------------------------------------------------------------------------

-- Create ROLEs and assign privileges using GRANT statements


-- #############################################################################
-- MSM Section 180: REST Service Definition
-- -----------------------------------------------------------------------------
-- This optional section is used to create MySQL REST Service endpoints
-- -----------------------------------------------------------------------------

-- Create a REST service, schema and endpoints


-- #############################################################################
-- MSM Section 190: Removal of Helpers
-- -----------------------------------------------------------------------------
-- Removal of optional helper PROCEDUREs and FUNCTIONs that are called during
-- the creation of the database schema. Note that DROP IF EXISTS needs to be
-- used.
-- -----------------------------------------------------------------------------

-- Drop optional helper PROCEDUREs and FUNCTIONs here


-- #############################################################################
-- MSM Section 910: Database Schema Version
-- -----------------------------------------------------------------------------
-- Setting the correct database schema version.
-- -----------------------------------------------------------------------------

CREATE OR REPLACE SQL SECURITY INVOKER
VIEW `${schema_name}`.`msm_schema_version` (
    `major`,`minor`,`patch`) AS
SELECT ${version_comma_str};


-- #############################################################################
-- MSM Section 920: Server Variable Restoration
-- -----------------------------------------------------------------------------
-- Restore the modified server variables to their original state.
-- -----------------------------------------------------------------------------

SET SQL_MODE=@OLD_SQL_MODE;
SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS;
SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS;
