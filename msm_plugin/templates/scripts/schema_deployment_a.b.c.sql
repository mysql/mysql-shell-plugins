-- Copyright (c) 2025, Oracle and/or its affiliates.
${license}
-- #############################################################################
-- MSM Section 003: Database Schema Deployment Script
-- -----------------------------------------------------------------------------
-- This script either creates or updates the database schema
-- `${schema_name}` to version ${version_target}
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
-- CREATE SCHEMA statement
-- -----------------------------------------------------------------------------

CREATE SCHEMA IF NOT EXISTS `${schema_name}`
    DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;


-- #############################################################################
-- MSM Section 330: Creation of Helpers
-- -----------------------------------------------------------------------------
-- Definitions of optional helper PROCEDUREs and FUNCTIONs that are called
-- during the creation and update of the database schema. It is important to
-- note that these must be defined in a way as if a schema object of the same
-- name and type already exists. Use explicit DROP IF EXISTS statements or
-- CREATE OR REPLACE statements when creating the helper objects. The names of
-- all helper routines need to start with `msm_`.
-- -----------------------------------------------------------------------------

${section_130_creation_of_helpers}

-- ### MSM-LOOP-START:UPDATABLE-VERSIONS - Update Non-Idempotent
${section_230_creation_of_update_helpers}
-- ### MSM-LOOP-END:UPDATABLE-VERSIONS - Update Non-Idempotent


-- #############################################################################
-- MSM Section 340: Non-Idempotent Deployment Procedures
-- -----------------------------------------------------------------------------
-- Create the stored procedures used for schema TABLE installation and updates.
-- These procedures will only be used during the installation and update
-- process and will be dropped afterwards.
-- -----------------------------------------------------------------------------

DELIMITER %%

-- ### MSM-LOOP-START:UPDATABLE-VERSIONS(indent=4) - Update Non-Idempotent
-- -----------------------------------------------------------------------------
-- PROCEDURE `${schema_name}`.`msm_update_${version_from}_to_${version_to}`
-- -----------------------------------------------------------------------------
-- Stored procedure to update TABLEs and VIEWs
-- from version ${version_from} to ${version_to}
-- -----------------------------------------------------------------------------
DROP PROCEDURE IF EXISTS
    `${schema_name}`.`msm_update_${version_from}_to_${version_to}`%%
CREATE PROCEDURE `${schema_name}`.`msm_update_${version_from}_to_${version_to}`()
SQL SECURITY INVOKER
BEGIN
${section_240_non_idempotent_schema_object_changes_and_all_drops}
END%%

-- ### MSM-LOOP-END:UPDATABLE-VERSIONS - Update Non-Idempotent
-- -----------------------------------------------------------------------------
-- PROCEDURE `${schema_name}`.`msm_create_${version_target}`
-- -----------------------------------------------------------------------------
-- Stored procedure to install schema TABLEs for version ${version_target}
-- -----------------------------------------------------------------------------
DROP PROCEDURE IF EXISTS
    `${schema_name}`.`msm_create_${version_target}`%%
CREATE PROCEDURE `${schema_name}`.`msm_create_${version_target}`()
SQL SECURITY INVOKER
BEGIN
${section_140_non_idempotent_schema_objects}
END%%

-- -----------------------------------------------------------------------------
-- PROCEDURE `${schema_name}`.`msm_create_or_update`
-- -----------------------------------------------------------------------------
-- Stored procedure to perform the version sensitive creation or update of
-- schema TABLEs
-- -----------------------------------------------------------------------------

DROP PROCEDURE IF EXISTS
    `${schema_name}`.`msm_create_or_update`%%
CREATE PROCEDURE `${schema_name}`.`msm_create_or_update`()
SQL SECURITY INVOKER
BEGIN
    DECLARE item_count INT;
    DECLARE version_str VARCHAR(255);
    DECLARE signal_msg VARCHAR(128);

    -- Check if the schema is yet empty
    SELECT COUNT(*) +
        (SELECT COUNT(*) FROM `information_schema`.`ROUTINES`
            WHERE ROUTINE_SCHEMA = '${schema_name}'
                AND ROUTINE_NAME NOT LIKE 'msm_%') +
        (SELECT COUNT(*) FROM `information_schema`.`EVENTS`
            WHERE `EVENT_SCHEMA` = '${schema_name}') INTO item_count
    FROM `information_schema`.`TABLES`
    WHERE `TABLE_SCHEMA` = '${schema_name}';

    -- If the schema is empty, create the schema from scratch
    IF item_count = 0 THEN
        -- Set the @msm_schema_init variable to indicate a fresh creation of the
        -- schema. This session variable is later used when creating roles
        SET @msm_schema_init = 1;

        -- Set `${schema_name}`.`msm_schema_version` VIEW
        -- to 0, 0, 0 to indicate start of update process
        CREATE OR REPLACE SQL SECURITY INVOKER
            VIEW `${schema_name}`.`msm_schema_version` (
                `major`,`minor`,`patch`) AS
                SELECT 0, 0, 0;

        CALL `${schema_name}`.`msm_create_${version_target}`();
    ELSE
        -- If the schema is not empty, update the schema
        SET @msm_schema_init = 0;

        -- Check if the schema is a managed one
        SELECT COUNT(*) INTO item_count FROM information_schema.`TABLES`
            WHERE `TABLE_SCHEMA` = '${schema_name}'
                AND `TABLE_NAME` = 'msm_schema_version'
                AND `TABLE_TYPE` = 'VIEW';
        IF item_count = 0 THEN
            SELECT COUNT(*) INTO item_count FROM `information_schema`.`TABLES`
                WHERE `TABLE_SCHEMA` = '${schema_name}';
            IF item_count > 0 THEN
                SET signal_msg = LEFT(CONCAT(
                    'The schema `${schema_name}` already exists but ',
                    'misses a msm_schema_version view ',
                    'and cannot be updated.'), 128);
                SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = signal_msg,
                    MYSQL_ERRNO = 32100;
            END IF;
        END IF;

        -- Get the current version of the schema
        SELECT CONCAT(v.major, '.', v.minor, '.', v.patch) INTO `version_str`
        FROM `${schema_name}`.`msm_schema_version` AS v;

        SET @msm_current_version = version_str;

        -- Check if the current version needs to be updated
        IF version_str != '${version_target}' THEN
            IF version_str = '0.0.0' THEN
                SET signal_msg = LEFT(CONCAT(
                    'The schema `${schema_name}` is already being updated ',
                    'as its version is set to 0.0.0.'), 128);
                SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = signal_msg,
                    MYSQL_ERRNO = 32101;
            END IF;

            -- Set `${schema_name}`.`msm_schema_version` VIEW
            -- to 0, 0, 0 to indicate start of update process
            CREATE OR REPLACE SQL SECURITY INVOKER
                VIEW `${schema_name}`.`msm_schema_version` (
                    `major`,`minor`,`patch`) AS
                    SELECT 0, 0, 0;


            -- Check if the current version can be updated by this script
            IF NOT JSON_CONTAINS('[${updatable_versions}]',
                JSON_QUOTE(version_str), '$') THEN
                SET signal_msg = LEFT(CONCAT(
                    'The schema `${schema_name}` is on version ', version_str,
                    ' which cannot be updated by this script.'), 128);
                SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = signal_msg,
                    MYSQL_ERRNO = 32102;
            END IF;

            -- Run the update scripts
-- ### MSM-LOOP-START:UPDATABLE-VERSIONS - Update Non-Idempotent
            IF version_str = '${version_from}' THEN
                CALL `${schema_name}`.`msm_update_${version_from}_to_${version_to}`();
                SET version_str = '${version_to}';
            END IF;

-- ### MSM-LOOP-END:UPDATABLE-VERSIONS - Update Non-Idempotent
        END IF;
    END IF;
END%%

DELIMITER ;

-- -----------------------------------------------------------------------------
-- Execute the installation/upgrade procedure for schema tables
-- -----------------------------------------------------------------------------

CALL `${schema_name}`.`msm_create_or_update`();

-- -----------------------------------------------------------------------------
-- Drop the stored procedures used for schema TABLE installation and updates.
-- -----------------------------------------------------------------------------

-- ### MSM-LOOP-START:UPDATABLE-VERSIONS - Update Non-Idempotent
DROP PROCEDURE `${schema_name}`.`msm_update_${version_from}_to_${version_to}`;
${section_260_removal_of_update_helpers}
-- ### MSM-LOOP-END:UPDATABLE-VERSIONS - Update Non-Idempotent
DROP PROCEDURE `${schema_name}`.`msm_create_${version_target}`;
DROP PROCEDURE `${schema_name}`.`msm_create_or_update`;


-- #############################################################################
-- MSM Section 150: Idempotent Schema Objects
-- -----------------------------------------------------------------------------
-- This section contains the creation of all schema objects except TABLEs.
-- All objects must be created under the assumption that an object of the same
-- name is already present. Therefore explicit DROP IF EXISTS statements or
-- CREATE OR REPLACE clauses must be used when creating the objects.
-- -----------------------------------------------------------------------------
-- All other schema object definitions (VIEWS, PROCEDUREs, FUNCTIONs, TRIGGERs,
-- EVENTS, ...)
-- -----------------------------------------------------------------------------

${section_150_idempotent_schema_objects}


-- #############################################################################
-- MSM Section 370: Authorization
-- -----------------------------------------------------------------------------
-- This section is used to define or update ROLEs and GRANTs.
-- -----------------------------------------------------------------------------

DELIMITER %%

-- ### MSM-LOOP-START:UPDATABLE-VERSIONS(indent=4) - Authorization
-- -----------------------------------------------------------------------------
-- PROCEDURE `${schema_name}`.`msm_auth_${version_from}_to_${version_to}`
-- -----------------------------------------------------------------------------
-- Stored procedure to perform the authorization changes from version ${version_from}
-- to ${version_to}
-- -----------------------------------------------------------------------------
DROP PROCEDURE IF EXISTS `${schema_name}`.`msm_auth_${version_from}_to_${version_to}`%%
CREATE PROCEDURE `${schema_name}`.`msm_auth_${version_from}_to_${version_to}`()
SQL SECURITY INVOKER
BEGIN
${section_270_authorization}
END%%

-- ### MSM-LOOP-END:UPDATABLE-VERSIONS - Authorization
-- -----------------------------------------------------------------------------
-- PROCEDURE `${schema_name}`.`msm_auth_${version_target}`
-- -----------------------------------------------------------------------------
-- Stored procedure to setup authorization for version ${version_target}
-- -----------------------------------------------------------------------------
DROP PROCEDURE IF EXISTS `${schema_name}`.`msm_auth_${version_target}`%%
CREATE PROCEDURE `${schema_name}`.`msm_auth_${version_target}`()
SQL SECURITY INVOKER
BEGIN
${section_170_authorization}
END%%

-- -----------------------------------------------------------------------------
-- PROCEDURE `${schema_name}`.`msm_auth`
-- -----------------------------------------------------------------------------
-- Stored procedure to setup authorization
-- -----------------------------------------------------------------------------
DROP PROCEDURE IF EXISTS `${schema_name}`.`msm_auth`%%
CREATE PROCEDURE `${schema_name}`.`msm_auth`()
SQL SECURITY INVOKER
BEGIN
    DECLARE version_str VARCHAR(255);

    SET version_str = @msm_current_version;

    IF @msm_schema_init THEN
        CALL `${schema_name}`.`msm_auth_${version_target}`();
    ELSE
        -- Run the update scripts if available, always DO NONE; cause
        -- the ELSE clause cannot be empty.
        DO NULL;
-- ### MSM-LOOP-START:UPDATABLE-VERSIONS - Authorization Updates
        IF version_str = '${version_from}' THEN
            CALL `${schema_name}`.`msm_auth_${version_from}_to_${version_to}`();
            SET version_str = '${version_to}';
        END IF;

-- ### MSM-LOOP-END:UPDATABLE-VERSIONS - Authorization Updates
    END IF;
END%%

DELIMITER ;

-- -----------------------------------------------------------------------------
-- Execute the installation/upgrade procedure to setup authorization
-- -----------------------------------------------------------------------------

CALL `${schema_name}`.`msm_auth`();

-- -----------------------------------------------------------------------------
-- Drop the stored procedures used for schema TABLE installation and updates.
-- -----------------------------------------------------------------------------

-- ### MSM-LOOP-START:UPDATABLE-VERSIONS - Update Non-Idempotent
DROP PROCEDURE `${schema_name}`.`msm_auth_${version_from}_to_${version_to}`;
${section_260_removal_of_update_helpers}
-- ### MSM-LOOP-END:UPDATABLE-VERSIONS - Update Non-Idempotent
DROP PROCEDURE `${schema_name}`.`msm_auth_${version_target}`;
DROP PROCEDURE `${schema_name}`.`msm_auth`;


-- #############################################################################
-- MSM Section 390: Removal of Helpers
-- -----------------------------------------------------------------------------
-- Removal of optional helper PROCEDUREs and FUNCTIONs that are called during
-- the creation and updates of the database schema
-- -----------------------------------------------------------------------------

-- ### MSM-LOOP-START:UPDATABLE-VERSIONS - Removal of Helpers
${section_290_removal_of_helpers}
-- ### MSM-LOOP-END:UPDATABLE-VERSIONS - Removal of Helpers

${section_190_removal_of_helpers}


-- #############################################################################
-- MSM Section 910: Database Schema Version
-- -----------------------------------------------------------------------------
-- Setting the correct database schema version
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
