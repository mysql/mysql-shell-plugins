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
-- from version 3.0.0 to 3.0.1
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
-- Trigger `mysql_tasks`.`task_log_impl_BEFORE_INSERT`
-- -----------------------------------------------------
DROP TRIGGER IF EXISTS `mysql_tasks`.`task_log_impl_BEFORE_INSERT`%%
CREATE TRIGGER `mysql_tasks`.`task_log_impl_BEFORE_INSERT`
BEFORE INSERT ON `mysql_tasks`.`task_log_impl` FOR EACH ROW
BEGIN
  DECLARE max_progress SMALLINT;

  IF NEW.progress IS NULL THEN
    -- Set progress to max for this task_id, or 0 if none found
    SELECT COALESCE(MAX(progress), 0)
    INTO max_progress
    FROM `mysql_tasks`.`task_log_impl`
    WHERE task_id = NEW.task_id;

    SET NEW.progress = max_progress;
  END IF;
END%%

-- -----------------------------------------------------
-- View `mysql_tasks`.`task_status_impl`
--   for internal use
-- Provides task information from the `task_impl` table alongside the
-- data from the `task_log_impl` table such as the time of the first log entry,
-- information from the latest log entry, as well as completion estimates
-- derived using the time of task start and task progress.
-- In case the task has been started on a MySQL server with a different
-- server_uuid, some information is masked.
-- Note: Regular users do not need privileges to use it.
-- -----------------------------------------------------
DROP VIEW IF EXISTS `mysql_tasks`.`task_status_impl`;
CREATE SQL SECURITY INVOKER VIEW `mysql_tasks`.`task_status_impl` AS
SELECT
  t.id AS id,
  t.app_user_id AS app_user_id,
  t.alias AS alias,
  t.server_uuid AS server_uuid,
  t.name AS name,
  t.mysql_user AS mysql_user,
  t.connection_id AS connection_id,
  t.task_type AS task_type,
  t.data AS data,
  last_tl.data AS log_data,
  IF (
    t.server_uuid = server_info.server_uuid,
    last_tl.message,
    'Not started on this server.'
  ) AS message,
  IF (
    t.server_uuid = server_info.server_uuid,
    tl.progress,
    0
  ) AS progress,
  IF (
    t.server_uuid = server_info.server_uuid,
    last_tl.status,
    'EXTERNAL'
  ) AS status,
  CAST(tl.first_log_time AS DATETIME) AS 'scheduled_time',
  IF (
    t.server_uuid = server_info.server_uuid,
    CAST(tl_running.first_log_time AS DATETIME),
    NULL
  ) AS 'starting_time',
  IF (
    t.server_uuid = server_info.server_uuid,
    IF(
      tl.progress = 0,
      NULL,
      CAST(
        TIMESTAMPADD(
          SECOND,
          ROUND(
            TIMESTAMPDIFF(
              SECOND,
              tl_running.first_log_time,
              tl.last_log_time
            ) / tl.progress * 100
          ),
          tl_running.first_log_time
        ) AS DATETIME
      )
    ),
    NULL
  ) AS 'estimated_completion_time',
  IF (
    t.server_uuid = server_info.server_uuid,
    IF(
      tl.progress = 0,
      NULL,
      TIMESTAMPDIFF(
        SECOND,
        tl_running.first_log_time,
        tl.last_log_time
      ) / tl.progress * 100.0 - TIMESTAMPDIFF(
        SECOND,
        tl_running.first_log_time,
        tl.last_log_time
      )
    ),
    NULL
  ) AS 'estimated_remaining_time',
  IF (
    t.server_uuid = server_info.server_uuid,
    CONCAT(
      REPEAT('#', FLOOR(tl.progress / 10)),
      REPEAT('_', 10 - FLOOR(tl.progress / 10))
    ),
    REPEAT('_', 10)
  ) AS 'progress_bar'
FROM
  `mysql_tasks`.`task_impl` t
INNER JOIN (
  SELECT
    tl1.task_id,
    MIN(tl1.log_time) AS first_log_time,
    MAX(tl1.log_time) AS last_log_time,
    MAX(tl1.progress) AS progress,
    COUNT(*) AS log_count
  FROM
    `mysql_tasks`.`task_log_impl` tl1
  GROUP BY
    tl1.task_id
) tl ON t.id = tl.task_id
LEFT OUTER JOIN `mysql_tasks`.`task_log_impl` last_tl
  ON last_tl.id = (
    SELECT tl2.id
    FROM `mysql_tasks`.`task_log_impl` tl2
    WHERE tl2.task_id = t.id
    ORDER BY tl2.log_time DESC
    LIMIT 1
  )
LEFT OUTER JOIN (
  SELECT
    tl3.task_id,
    MIN(tl3.log_time) AS first_log_time
  FROM
    `mysql_tasks`.`task_log_impl` tl3
  WHERE
    status = 'RUNNING'
  GROUP BY
    tl3.task_id
) tl_running ON t.id = tl_running.task_id
JOIN (
  SELECT UUID_TO_BIN(VARIABLE_VALUE, 1) AS server_uuid
  FROM performance_schema.global_variables
  WHERE VARIABLE_NAME = 'server_uuid'
) server_info ON 1 = 1;

-- -----------------------------------------------------
-- Procedure `mysql_tasks`.`start_task_monitor`
--   for internal use
-- -----------------------------------------------------
DROP PROCEDURE IF EXISTS `mysql_tasks`.`start_task_monitor`%%
CREATE PROCEDURE `mysql_tasks`.`start_task_monitor`(
  IN `event_name` TEXT,
  IN `task_id` VARCHAR(36),
  IN `sql_statements` TEXT,
  IN `refresh_period` DECIMAL(5,2)
)
SQL SECURITY INVOKER
COMMENT '
  Starts a task monitor SQL Event. It periodically updates the task progress.
  Parameters:
  - event_name: fully qualified name of the SQL Event that runs the
      monitoring SQL statements
  - task_id: UUID of the task being monitored
  - sql_statements: the monitoring SQL statements (separated by ;)
  - refresh_period: interval at which the monitoring sql statements
      are executed (in seconds)'
BEGIN
  DECLARE task_mgmt_version TEXT DEFAULT NULL;

  IF @mysql_tasks_initiated IS NULL THEN
    SIGNAL SQLSTATE 'HY000' SET
    MESSAGE_TEXT = 'start_task_monitor procedure should not be called directly';
  END IF;

  IF sql_statements IS NOT NULL AND event_name IS NOT NULL THEN
    IF refresh_period IS NULL THEN
      SET refresh_period = 5;
    ELSEIF refresh_period <= 0 THEN
      SIGNAL SQLSTATE '45000'
        SET MESSAGE_TEXT = 'refresh_period must be a positive number',
        MYSQL_ERRNO = 1108;
    END IF;

    SELECT
      CONCAT(major, '.', minor, '.', patch)
    FROM
      `mysql_tasks`.`msm_schema_version` INTO task_mgmt_version;

    -- ensure the SQL statements end with a semicolon
    IF NOT REGEXP_LIKE(sql_statements, ';[:space:]*$') THEN
      SET sql_statements = CONCAT(sql_statements, '; ');
    END IF;

    SET @eventSql = CONCAT(
      'CREATE EVENT ', event_name, ' ',
      'ON SCHEDULE AT NOW() ON COMPLETION NOT PRESERVE ENABLE ',
      'COMMENT ''mysql_tasks_schema_version=', task_mgmt_version, ''' ',
      'DO BEGIN ',
      'DECLARE do_run BOOLEAN DEFAULT TRUE; ',
      'DECLARE initiate_name TEXT DEFAULT ''task_monitor_event''; ',
      'DECLARE lock_name VARCHAR(64) DEFAULT ', QUOTE(RIGHT(event_name,64)),';',

      'DECLARE EXIT HANDLER FOR SQLEXCEPTION BEGIN ',
      '  GET DIAGNOSTICS CONDITION 1 ',
      '   @p1 = RETURNED_SQLSTATE, @p2 = MYSQL_ERRNO, @p3 = MESSAGE_TEXT; ',
      '  CALL `mysql_tasks`.`add_task_log`(',
          QUOTE(task_id),', CONCAT(''Error: '', @p3), NULL, NULL, ''RUNNING''); ',
      '  IF @mysql_tasks_initiated <=> initiate_name THEN ',
      '    SET @mysql_tasks_initiated = NULL; ',
      '  END IF; ',
      'END; ',
      'SET ROLE ALL; ',
      'SET @task_id =', QUOTE(task_id), '; ',
      'IF @mysql_tasks_initiated IS NULL THEN ',
      '  SET @mysql_tasks_initiated = initiate_name; ',
      'END IF; ',

      -- synchronization with thread calling end_task_monitor
      -- if the event was dropped (not found in information_schema.events)
      -- terminate it
      'IF (GET_LOCK(lock_name, 60) <=> 1 AND ',
      '(SELECT COUNT(*)>0 FROM information_schema.events ise ',
      '   WHERE CONCAT(mysql_tasks.quote_identifier(ise.event_schema), ',
      '   ''.'', mysql_tasks.quote_identifier(ise.event_name)) = ',
          QUOTE(event_name), ')) THEN ',
      '  CALL `mysql_tasks`.`add_task_log`(@task_id, ',
      '     ''Progress monitor started.'', ',
      '     JSON_OBJECT(''connection_id'', CONNECTION_ID()), 0, ''RUNNING''); ',
      'END IF; ',
      'WHILE IS_USED_LOCK(lock_name) <=> CONNECTION_ID() DO ',
      '  DO RELEASE_LOCK(lock_name); ',
      'END WHILE; ',

      -- if at any time event gets killed, terminate its while loop
      'WHILE (SELECT COUNT(*)>0 FROM information_schema.events ise ',
      '   WHERE CONCAT(mysql_tasks.quote_identifier(ise.event_schema), ',
      '   ''.'', mysql_tasks.quote_identifier(ise.event_name)) = ',
          QUOTE(event_name), ') DO ',
         sql_statements,
      '  DO SLEEP(', refresh_period, '); ',
      'END WHILE; ',
      'SET @task_id = NULL; ',
      'IF @mysql_tasks_initiated <=> initiate_name THEN ',
      '  SET @mysql_tasks_initiated = NULL; ',
      'END IF; ',
      'END'
    );

    PREPARE dynamic_statement FROM @eventSql;
    EXECUTE dynamic_statement;
    DEALLOCATE PREPARE dynamic_statement;

  END IF;
END%%

-- -----------------------------------------------------
-- EVENT `mysql_tasks`.`task_cleanup`
-- Periodically cleans up data from old tasks.
-- Old tasks must have finished (COMPLETED, CANCELLED)
-- at least 6 days ago.
-- -----------------------------------------------------
DROP EVENT IF EXISTS `mysql_tasks`.`task_cleanup`%%
CREATE EVENT `mysql_tasks`.`task_cleanup` ON SCHEDULE EVERY 1 DAY
ON COMPLETION NOT PRESERVE ENABLE COMMENT 'Clean up old tasks' DO
BEGIN
  DECLARE batch_size INTEGER DEFAULT 100;
  DECLARE initiate_name TEXT DEFAULT 'task_cleanup';

  IF @mysql_tasks_initiated IS NULL THEN
    SET @mysql_tasks_initiated = initiate_name;
  END IF;

  DROP TEMPORARY TABLE IF EXISTS `mysql_tasks`.`tmp_tasks_to_delete`;
  CREATE TEMPORARY TABLE `mysql_tasks`.`tmp_tasks_to_delete` (
    task_id BINARY(16) PRIMARY KEY
  );

  -- find all tasks with last tog time
  -- 6 days or older from the current date
  INSERT INTO `mysql_tasks`.`tmp_tasks_to_delete` (task_id)
  WITH latest_logs AS (
    SELECT *
    FROM (
      SELECT
        tl.*,
        ROW_NUMBER() OVER (
          PARTITION BY task_id ORDER BY log_time DESC, id DESC
        ) AS rn
      FROM mysql_tasks.task_log_impl tl
    ) ranked
    WHERE rn = 1
  )
  SELECT t.id
  FROM `mysql_tasks`.`task_impl` t
  JOIN latest_logs l ON l.task_id = t.id
  WHERE l.status NOT IN ('SCHEDULED', 'RUNNING')
    AND l.log_time <= DATE_SUB(CURDATE(), INTERVAL 6 DAY)
    AND t.server_uuid <=> UUID_TO_BIN(@@server_uuid, 1);

  -- delete old tasks in batches
  REPEAT
    DELETE FROM `mysql_tasks`.`task_impl`
    WHERE id IN (
      SELECT task_id FROM (
        SELECT task_id
        FROM `mysql_tasks`.`tmp_tasks_to_delete`
        ORDER BY task_id
        LIMIT batch_size
      ) limited_ids
    );

    -- Also delete from the temp table to track progress
    DELETE FROM `mysql_tasks`.`tmp_tasks_to_delete`
    ORDER BY task_id
    LIMIT batch_size;

    SET @row_count = ROW_COUNT();

    -- Wait a little to reduce pressure
    DO SLEEP(1);

  UNTIL @row_count = 0
  END REPEAT;

  DROP TEMPORARY TABLE `mysql_tasks`.`tmp_tasks_to_delete`;


  IF @mysql_tasks_initiated <=> initiate_name THEN
    SET @mysql_tasks_initiated = NULL;
  END IF;

END%%

-- -----------------------------------------------------
-- EVENT `mysql_tasks`.`task_gc`
-- Periodic garbage collector that cleans up tasks
-- which are in the active state but their
-- process does not exist.
-- -----------------------------------------------------
DROP EVENT IF EXISTS `mysql_tasks`.`task_gc`%%
CREATE EVENT `mysql_tasks`.`task_gc` ON SCHEDULE EVERY 1 MINUTE
ON COMPLETION NOT PRESERVE ENABLE COMMENT 'Garbage collector' DO
BEGIN
  DECLARE i, j INT DEFAULT 0;
  DECLARE json_id JSON DEFAULT NULL;
  DECLARE json_user JSON DEFAULT NULL;
  DECLARE json_data JSON DEFAULT NULL;
  DECLARE curr_id VARCHAR(36) DEFAULT NULL;
  DECLARE curr_user TEXT DEFAULT NULL;
  DECLARE curr_data JSON DEFAULT NULL;
  DECLARE event_name TEXT DEFAULT NULL;
  DECLARE initiate_name TEXT DEFAULT 'task_gc';

  IF @mysql_tasks_initiated IS NULL THEN
    SET @mysql_tasks_initiated = initiate_name;
  END IF;

  DROP TEMPORARY TABLE IF EXISTS `mysql_tasks`.`processlist_snapshot`;
  CREATE TEMPORARY TABLE `mysql_tasks`.`processlist_snapshot`
  (pk INT AUTO_INCREMENT PRIMARY KEY)
  AS
  SELECT * FROM `performance_schema`.`processlist`;

  -- Find active tasks without alive process
  SELECT JSON_ARRAYAGG(
    BIN_TO_UUID(t.id, 1)),
    JSON_ARRAYAGG(t.mysql_user),
    JSON_ARRAYAGG(t.data)
  INTO
    json_id,
    json_user,
    json_data
  FROM `mysql_tasks`.`task_impl` t
  JOIN (
    SELECT task_id
    FROM `mysql_tasks`.`task_log_impl`
    GROUP BY task_id
    HAVING SUM(status IN ('COMPLETED', 'ERROR', 'CANCELLED')) = 0
  ) tl
  ON tl.task_id = t.id
  LEFT JOIN `mysql_tasks`.`processlist_snapshot` p ON t.connection_id = p.id
  WHERE
    p.id IS NULL
    AND t.server_uuid <=> UUID_TO_BIN(@@server_uuid, 1)
    AND t.data->'$.mysqlMetadata.autoGc' <=> TRUE;

  WHILE i < JSON_LENGTH(json_id) DO
    SET curr_id = JSON_UNQUOTE(JSON_EXTRACT(json_id, CONCAT('$[', i, ']')));
    SET curr_user = JSON_UNQUOTE(JSON_EXTRACT(json_user, CONCAT('$[', i, ']')));
    SET curr_data = JSON_EXTRACT(json_data, CONCAT('$[', i, ']'));

    IF curr_data IS NOT NULL AND
        JSON_CONTAINS_PATH(curr_data, 'one', '$.mysqlMetadata.events')  THEN
      SET j = 0;
      WHILE j < JSON_LENGTH(
          JSON_EXTRACT(curr_data, '$.mysqlMetadata.events')) DO
        SET event_name = JSON_UNQUOTE(
          JSON_EXTRACT(curr_data, CONCAT('$.mysqlMetadata.events[', j, ']')));
        CALL `mysql_tasks`.`drop_event`(event_name);
        SET j = j + 1;
      END WHILE;
    END IF;

    IF curr_id IS NOT NULL THEN
      INSERT INTO `mysql_tasks`.`task_log_impl`(
        `id`, `mysql_user`, `task_id`, `log_time`,
        `message`, `data`, `progress`, `status`)
      VALUES (
        UUID_TO_BIN(UUID(), 1), curr_user, UUID_TO_BIN(curr_id, 1), NOW(6),
        'Cleaned up by system.', NULL, 100, 'CANCELLED');
    END IF;

    SELECT i + 1 INTO i;
  END WHILE;

  -- Find dangling events from tasks which are no longer running
  SELECT JSON_ARRAYAGG(BIN_TO_UUID(t.id, 1)), JSON_ARRAYAGG(t.data)
  INTO
    json_id, json_data
  FROM `mysql_tasks`.`task_impl` t
  JOIN (
    SELECT task_id
    FROM `mysql_tasks`.`task_log_impl`
    GROUP BY task_id
    HAVING SUM(status IN ('COMPLETED', 'ERROR', 'CANCELLED')) > 0
  ) tl
  ON tl.task_id = t.id
  JOIN information_schema.events ise
    ON EXISTS (
      SELECT 1
      FROM JSON_TABLE(
        t.data->'$.mysqlMetadata.events',
        '$[*]' COLUMNS(event_name VARCHAR(255) PATH '$')
      ) AS events_unnested
    WHERE JSON_UNQUOTE(events_unnested.event_name) =
      CONCAT(
        mysql_tasks.quote_identifier(ise.EVENT_SCHEMA),
        '.',
        mysql_tasks.quote_identifier(ise.EVENT_NAME)
      )
    )
  LEFT JOIN `mysql_tasks`.`processlist_snapshot` p ON t.connection_id = p.id
  WHERE
    p.id IS NULL
    AND t.server_uuid <=> UUID_TO_BIN(@@server_uuid, 1)
    AND t.data->'$.mysqlMetadata.autoGc' <=> TRUE;

  WHILE i < JSON_LENGTH(json_id) DO
    SET curr_data = JSON_EXTRACT(json_data, CONCAT('$[', i, ']'));

    IF curr_data IS NOT NULL AND
        JSON_CONTAINS_PATH(curr_data, 'one', '$.mysqlMetadata.events')  THEN
      SET j = 0;
      WHILE j < JSON_LENGTH(
          JSON_EXTRACT(curr_data, '$.mysqlMetadata.events')) DO
        SET event_name = JSON_UNQUOTE(
          JSON_EXTRACT(curr_data, CONCAT('$.mysqlMetadata.events[', j, ']')));
        CALL `mysql_tasks`.`drop_event`(event_name);
        SET j = j + 1;
      END WHILE;
    END IF;

    SELECT i + 1 INTO i;
  END WHILE;

  DROP TEMPORARY TABLE `mysql_tasks`.`processlist_snapshot`;

  IF @mysql_tasks_initiated <=> initiate_name THEN
    SET @mysql_tasks_initiated = NULL;
  END IF;
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
SELECT 3, 0, 1;


-- #############################################################################
-- MSM Section 920: Server Variable Restoration
-- -----------------------------------------------------------------------------
-- Restore the modified server variables to their original state.
-- #############################################################################

SET SQL_MODE=@OLD_SQL_MODE;
SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS;
SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS;
