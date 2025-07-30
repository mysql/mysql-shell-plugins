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
-- from version 4.1.3 to 4.1.4
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

USE `mysql_rest_service_metadata`;

CREATE OR REPLACE SQL SECURITY INVOKER
VIEW `msm_schema_version` (`major`,`minor`,`patch`) AS
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

DROP PROCEDURE IF EXISTS `sdk_service_data`%%
CREATE PROCEDURE `sdk_service_data`(IN service_id BINARY(16))
BEGIN
    DECLARE service_res JSON;
    DECLARE schema_id BINARY(16);
    DECLARE schema_res JSON;

    -- Get all db_schemas of the given service, fetch the id to do the nested SELECTs and
    -- the data as JSON
    DECLARE schema_loop_done TINYINT DEFAULT FALSE;
    DECLARE schema_cursor CURSOR FOR
        SELECT s.id,
            JSON_OBJECT(
                'id', s.id,
                'name', s.name,
                'schema_type', s.schema_type,
                'request_path', s.request_path,
                'requires_auth', s.requires_auth,
                'internal', s.internal,
                'options', s.options
            )
        FROM mysql_rest_service_metadata.db_schema AS s
        WHERE s.service_id = service_id AND s.enabled = 1;
    DECLARE CONTINUE HANDLER FOR NOT FOUND SET schema_loop_done = 1;

    -- Get the service data as JSON
    SELECT
        JSON_OBJECT(
            'id', s.id,
            'url_context_root', s.url_context_root,
            'name', s.name,
            'enabled', s.enabled,
            'published', s.published,
            'options', s.options,
            'auth_path', s.auth_path,
            'auth_completed_url_validation', s.auth_completed_url_validation
        )
        INTO service_res
    FROM mysql_rest_service_metadata.service AS s
    WHERE s.id = service_id;

    -- Initiate the list of db_schemas with an empty JSON array
    SET service_res = JSON_SET(service_res, '$.db_schemas', json_array());

    -- Loop over all db_schema of the given service
    OPEN schema_cursor;
    schema_loop: LOOP
        -- Get the next db_schema of the service
        FETCH NEXT FROM schema_cursor INTO schema_id, schema_res;

        IF schema_loop_done THEN
            LEAVE schema_loop;
        ELSE schema_block: BEGIN
            -- Get all db_objects of the given db_schema, fetch the id to do the nested SELECTs and
            -- the data as JSON
            DECLARE db_object_id BINARY(16);
            DECLARE db_object_res JSON;
            DECLARE db_object_loop_done TINYINT DEFAULT FALSE;
            DECLARE db_object_cursor CURSOR FOR
                SELECT o.id,
                    JSON_OBJECT(
                        'id', o.id,
                        'name', o.name,
                        'request_path', o.request_path,
                        'internal', o.internal,
                        'object_type', o.object_type,
                        'crud_operations', o.crud_operations,
                        'format', o.format,
                        'requires_auth', o.requires_auth,
                        'options', o.options
                    )
                FROM mysql_rest_service_metadata.db_object AS o
                WHERE o.db_schema_id = schema_id AND o.enabled = 1;
            DECLARE CONTINUE HANDLER FOR NOT FOUND SET db_object_loop_done = 1;

            -- Initiate the list of db_objects with an empty JSON array
            SET schema_res = JSON_SET(schema_res, '$.db_objects', json_array());

            -- Loop over all db_objects of the given db_schema
            OPEN db_object_cursor;
            db_object_loop: LOOP
                FETCH NEXT FROM db_object_cursor INTO db_object_id, db_object_res;

                IF db_object_loop_done THEN
                    LEAVE db_object_loop;
                ELSE db_object_block: BEGIN
                    DECLARE object_id BINARY(16);
                    DECLARE object_res JSON;
                    DECLARE object_loop_done TINYINT DEFAULT FALSE;
                    DECLARE object_cursor CURSOR FOR
                        SELECT o.id,
                          JSON_OBJECT(
                            'id', o.id,
                            'db_object_id', o.db_object_id,
                            'name', name,
                            'kind', kind,
                            'position', position,
                            'row_ownership_field_id', row_ownership_field_id,
                            'options', options,
                            'sdk_options', sdk_options
                          )
                      FROM mysql_rest_service_metadata.object AS o
                      WHERE o.db_object_id = db_object_id
                      ORDER BY position;
                    DECLARE CONTINUE HANDLER FOR NOT FOUND SET object_loop_done = 1;

                    -- Initiate the list of objects with an empty JSON array
                    SET db_object_res = JSON_SET(db_object_res, '$.objects', json_array());

                    -- Loop over all SDK object instances of the given db_object
                    OPEN object_cursor;
                    object_loop: LOOP
                        FETCH NEXT FROM object_cursor INTO object_id, object_res;

                        IF object_loop_done THEN
                            LEAVE object_loop;
                        ELSE object_block: BEGIN
                            DECLARE field_id BINARY(16);
                            DECLARE field_res JSON;
                            DECLARE field_loop_done TINYINT DEFAULT FALSE;
                            DECLARE field_cursor CURSOR FOR
                                SELECT f.id,
                                    JSON_OBJECT(
                                        'caption', f.caption,
                                        'lev', f.lev,
                                        'position', f.position,
                                        'id', f.id,
                                        'represents_reference_id', f.represents_reference_id,
                                        'parent_reference_id', f.parent_reference_id,
                                        'object_id', f.object_id,
                                        'name', f.name,
                                        'db_column', f.db_column,
                                        'enabled', f.enabled,
                                        'allow_filtering', f.allow_filtering,
                                        'allow_sorting', f.allow_sorting,
                                        'no_check', f.no_check,
                                        'no_update', f.no_update,
                                        'options', f.options,
                                        'sdk_options', f.sdk_options,
                                        'object_reference', f.object_reference
                                    )
                                FROM mysql_rest_service_metadata.object_fields_with_references AS f
                                WHERE f.object_id = object_id;
                            DECLARE CONTINUE HANDLER FOR NOT FOUND SET field_loop_done = 1;

                            -- Initiate the list of fields with an empty JSON array
                            SET object_res = JSON_SET(object_res, '$.fields', json_array());

                            -- Loop over all fields of the given SDK object
                            OPEN field_cursor;
                            field_loop: LOOP
                                FETCH NEXT FROM field_cursor INTO field_id, field_res;

                                IF field_loop_done THEN
                                    LEAVE field_loop;
                                ELSE field_block: BEGIN
                                    -- Append the field JSON data to the object's fields array
                                    SET object_res = JSON_ARRAY_APPEND(object_res, '$.fields', field_res);
                                END field_block; END IF;
                            END LOOP field_loop;

                            -- Append the SDK object JSON data to the db_objects's objects array
                            SET db_object_res = JSON_ARRAY_APPEND(db_object_res, '$.objects', object_res);
                        END object_block; END IF;
                    END LOOP object_loop;

                    -- Append the db_object JSON data to the db_schema's db_objects array
                    SET schema_res = JSON_ARRAY_APPEND(schema_res, '$.db_objects', db_object_res);

                END db_object_block; END IF;
            END LOOP db_object_loop;

            -- Append the db_schema JSON data to the service's db_schemas array
            SET service_res = JSON_ARRAY_APPEND(service_res, '$.db_schemas', schema_res);

            CLOSE db_object_cursor;
        END schema_block; END IF;
    END LOOP schema_loop;

    CLOSE schema_cursor;

    -- Return the JSON data as a result set
    SELECT service_res;
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

USE `mysql_rest_service_metadata`;

CREATE OR REPLACE SQL SECURITY INVOKER
VIEW `msm_schema_version` (`major`,`minor`,`patch`) AS
SELECT 4, 1, 4;


-- #############################################################################
-- MSM Section 920: Server Variable Restoration
-- -----------------------------------------------------------------------------
-- Restore the modified server variables to their original state.
-- #############################################################################

SET SQL_MODE=@OLD_SQL_MODE;
SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS;
SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS;
