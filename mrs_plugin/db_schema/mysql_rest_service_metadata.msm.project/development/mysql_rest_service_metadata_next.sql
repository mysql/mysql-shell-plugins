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
-- MSM Section 000: Database Schema Development Script
-- -----------------------------------------------------------------------------
-- This script contains the current development version of the database schema
-- `mysql_rest_service_metadata`
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

CREATE SCHEMA IF NOT EXISTS `mysql_rest_service_metadata`
    DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;

-- #############################################################################
-- MSM Section 120: Database Schema Version Creation Indication
-- -----------------------------------------------------------------------------
-- Create the `mysql_rest_service_metadata`.`msm_schema_version` VIEW
-- and initialize it with the version 0, 0, 0 which indicates the ongoing
-- creation processes of the database schema.
-- -----------------------------------------------------------------------------

CREATE OR REPLACE SQL SECURITY INVOKER
VIEW `mysql_rest_service_metadata`.`msm_schema_version` (
    `major`,`minor`,`patch`) AS
SELECT 0, 0, 0;

-- #############################################################################
-- MSM Section 130: Creation of Helpers
-- -----------------------------------------------------------------------------
-- Definitions of optional helper PROCEDUREs and FUNCTIONs that are called
-- during the creations of the database schema.
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

SOURCE './sections/140-10_tables.sql'[1058:-115]; -- Ignore header and footer

SOURCE './sections/140-20_table_additions.sql'[53:]; -- Remove copyright

SOURCE './sections/140-30_inserts.sql'[53:]; -- Remove copyright

SOURCE './sections/140-40_default_static_content.sql'[53:]; -- Remove copyright

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

SOURCE './sections/150-10_views.sql'[53:]; -- Remove copyright

SOURCE './sections/150-20_procedures_functions.sql'[53:]; -- Remove copyright

SOURCE './sections/150-30_triggers.sql'[53:]; -- Remove copyright

SOURCE './sections/150-40_audit_log_triggers.sql'[53:]; -- Remove copyright

SOURCE './sections/150-50_events.sql'[53:]; -- Remove copyright

-- #############################################################################
-- MSM Section 170: Authorization
-- -----------------------------------------------------------------------------
-- This section is used to define the ROLEs and GRANT statements.
-- -----------------------------------------------------------------------------

SOURCE './sections/170_roles.sql'[53:]; -- Remove copyright

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
