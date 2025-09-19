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
-- This script updates the database schema `mysql_tasks`
-- from version 3.0.1 to 3.0.2
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
-- Replace the `mysql_tasks`.`msm_schema_version` VIEW
-- and initialize it with the version 0, 0, 0 which indicates the ongoing
-- update processes of the database schema.
-- #############################################################################

USE `mysql_tasks`;

CREATE OR REPLACE SQL SECURITY INVOKER
VIEW `msm_schema_version` (`major`,`minor`,`patch`) AS
SELECT 0, 0, 0;


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

-- -----------------------------------------------------
-- Function `mysql_tasks`.`app_task_status`
-- -----------------------------------------------------
DROP FUNCTION IF EXISTS `mysql_tasks`.`app_task_status`%%
CREATE FUNCTION `mysql_tasks`.`app_task_status`(
    app_user_id VARCHAR(255),
    id_or_alias VARCHAR(36)
  )
  RETURNS JSON
  READS SQL DATA
  SQL SECURITY DEFINER
  COMMENT '
    Returns status of an application task
    Parameters:
    - app_user_id: application user id to filter the list on
    - id_or_alias: task UUID or its unique alias'
BEGIN
  DECLARE task_id VARCHAR(36);

  SELECT `mysql_tasks`.`get_task_id`(id_or_alias) INTO task_id;

  RETURN (
    SELECT
      JSON_OBJECT(
        'id', BIN_TO_UUID(sq.id, 1),
        'alias', sq.alias,
        'server_uuid', BIN_TO_UUID(sq.server_uuid, 1),
        'name', sq.name,
        'connection_id', sq.connection_id,
        'task_type', sq.task_type,
        'task_data', sq.data,
        'data', sq.log_data,
        'message', sq.message,
        'progress', sq.progress,
        'status', sq.status,
        'scheduled_time', sq.scheduled_time,
        'starting_time', sq.starting_time,
        'estimated_completion_time', sq.estimated_completion_time,
        'estimated_remaining_time', sq.estimated_remaining_time,
        'progress_bar', sq.progress_bar,
        'row_hash', SHA2(CONCAT_WS(',',
            sq.status, sq.message, sq.progress, sq.data, sq.log_data,
            sq.scheduled_time, sq.starting_time, sq.estimated_completion_time,
            sq.estimated_remaining_time
          )
        , 256)
      )
    FROM (
      SELECT * FROM
        `mysql_tasks`.`task_status_impl` tsi
      WHERE
        mysql_tasks.extract_username(tsi.mysql_user) =
          BINARY mysql_tasks.extract_username(SESSION_USER())
        AND (`app_user_id` IS NULL OR tsi.app_user_id = BINARY `app_user_id`)
        AND tsi.id = UUID_TO_BIN(`task_id`, 1)
    ) sq
  );
END%%

-- -----------------------------------------------------
-- Function `mysql_tasks`.`app_task_status_list`
-- -----------------------------------------------------
DROP FUNCTION IF EXISTS `mysql_tasks`.`app_task_status_list`%%
CREATE FUNCTION `mysql_tasks`.`app_task_status_list`(
    `app_user_id` VARCHAR(255),
    `task_type` VARCHAR(80),
    `offset` INT UNSIGNED,
    `limit` INT UNSIGNED
  )
  RETURNS JSON
  READS SQL DATA
  SQL SECURITY DEFINER
  COMMENT '
    Returns a paginated list of application task statuses
    Parameters:
    - app_user_id: application user id to filter the list on
    - task_type: type to filter on, if NULL returns all types
    - offset: pagination offset
    - limit: pagination limit'
BEGIN

  IF `task_type` IS NULL THEN
    SET `task_type` = '%';
  END IF;

  IF `offset` IS NULL THEN
    SET `offset` = 0;
  END IF;

  IF `limit` IS NULL THEN
    SET `limit` = 20;
  END IF;

  RETURN (
    SELECT JSON_ARRAYAGG(
      JSON_OBJECT(
        'id', BIN_TO_UUID(sq.id, 1),
        'alias', sq.alias,
        'server_uuid', BIN_TO_UUID(sq.server_uuid, 1),
        'name', sq.name,
        'task_type', sq.task_type,
        'task_data', sq.data,
        'data', sq.log_data,
        'message', sq.message,
        'progress', sq.progress,
        'status', sq.status,
        'scheduled_time', sq.scheduled_time,
        'starting_time', sq.starting_time,
        'estimated_completion_time', sq.estimated_completion_time,
        'estimated_remaining_time', sq.estimated_remaining_time,
        'progress_bar', sq.progress_bar,
        'row_hash', SHA2(CONCAT_WS(',',
            sq.status, sq.message, sq.progress, sq.data, sq.log_data,
            sq.scheduled_time, sq.starting_time, sq.estimated_completion_time,
            sq.estimated_remaining_time
          )
        , 256)
      )
    )
    FROM (
      SELECT * FROM
        `mysql_tasks`.`task_status_impl` tsi
      WHERE
        mysql_tasks.extract_username(tsi.mysql_user) =
          BINARY mysql_tasks.extract_username(SESSION_USER())
        AND (`app_user_id` IS NULL OR tsi.app_user_id = BINARY `app_user_id`)
        AND tsi.task_type LIKE `task_type`
      ORDER BY tsi.id DESC
      LIMIT `limit` OFFSET `offset`
    ) sq
  );
END%%

DELIMITER ;


-- #############################################################################
-- MSM Section 910: Database Schema Version Definition
-- -----------------------------------------------------------------------------
-- Setting the correct database schema version.
-- #############################################################################

USE `mysql_tasks`;

CREATE OR REPLACE SQL SECURITY INVOKER
VIEW `msm_schema_version` (`major`,`minor`,`patch`) AS
SELECT 3, 0, 2;


-- #############################################################################
-- MSM Section 920: Server Variable Restoration
-- -----------------------------------------------------------------------------
-- Restore the modified server variables to their original state.
-- #############################################################################

SET SQL_MODE=@OLD_SQL_MODE;
SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS;
SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS;
