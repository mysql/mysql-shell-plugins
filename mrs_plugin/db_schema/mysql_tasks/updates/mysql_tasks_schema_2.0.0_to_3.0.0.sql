/*
 * Copyright (c) 2021, 2025, Oracle and/or its affiliates.
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

-- -----------------------------------------------------
-- MySQL Tasks Schema - UPDATE Script

-- NOTE: This script requires the MySQL Tasks schema version 2.0.0 to be already deployed.
-- Execute mysql_tasks_schema_2.0.0.sql before running this script.


ALTER TABLE `mysql_tasks`.`task_impl`
    CHANGE COLUMN app_user_id app_user_id VARCHAR(255) COMMENT 'An optional ID representing a specific application user. If set, the app_user_id will be used to filter tasks per application users, preventing an app user to see tasks from other app users.';

-- -----------------------------------------------------
-- Trigger `mysql_tasks`.`task_impl_BEFORE_INSERT`
-- -----------------------------------------------------
DROP TRIGGER IF EXISTS `mysql_tasks`.`task_impl_BEFORE_INSERT`;
DELIMITER $$
CREATE TRIGGER `mysql_tasks`.`task_impl_BEFORE_INSERT`
BEFORE INSERT ON `mysql_tasks`.`task_impl` FOR EACH ROW
BEGIN
  DECLARE day_abbr VARCHAR(3);
  DECLARE max_index INT UNSIGNED;

  -- Get the abbreviated day of the week
  SET day_abbr = DATE_FORMAT(CURDATE(), '%a');

  -- Find the next free index for the given user
  SELECT /*+ SET_VAR(use_secondary_engine=off) */
    IFNULL(
      MAX(
        CAST(SUBSTRING_INDEX(alias, '-', -1) AS UNSIGNED)
      ), 0
    ) + 1
  INTO
    max_index
  FROM
    `mysql_tasks`.`task_impl`
  WHERE
    `mysql_user` = NEW.mysql_user
    AND alias LIKE CONCAT(day_abbr, '-%');

  -- Set the alias (if not set)
  SET NEW.`alias` = COALESCE(NEW.`alias`, CONCAT(day_abbr, '-', max_index));

  -- Set the server uuid (if not set)
  SET NEW.`server_uuid` = COALESCE(NEW.`server_uuid`, UUID_TO_BIN(@@server_uuid, 1));

END$$
DELIMITER ;

-- -----------------------------------------------------
-- Function `mysql_tasks`.`app_task_list`
-- -----------------------------------------------------
DROP FUNCTION IF EXISTS `mysql_tasks`.`app_task_list`;
DELIMITER $$
CREATE FUNCTION `mysql_tasks`.`app_task_list`(
  `app_user_id` VARCHAR(255),
  `task_type` VARCHAR(80),
  `offset` INT UNSIGNED,
  `limit` INT UNSIGNED
)
  RETURNS JSON
  READS SQL DATA
  SQL SECURITY DEFINER
BEGIN
  DECLARE tasks JSON DEFAULT NULL;

  IF `task_type` IS NULL THEN
    SET `task_type` = '%';
  END IF;

  IF `offset` IS NULL THEN
    SET `offset` = 0;
  END IF;

  IF `limit` IS NULL THEN
    SET `limit` = 20;
  END IF;

  SELECT /*+ SET_VAR(use_secondary_engine=off) */ JSON_ARRAYAGG(
    JSON_OBJECT(
      'id', BIN_TO_UUID(t.id, 1),
      'name', t.name,
      'connection_id', t.connection_id,
      'task_type', t.task_type,
      'data', t.data
  )) INTO tasks
  FROM (
    SELECT t1.id, t1.name, t1.connection_id,
           t1.task_type, t1.data
    FROM
      `mysql_tasks`.`task_impl` t1
    WHERE
      (LEFT(t1.`mysql_user`, (LENGTH(t1.`mysql_user`) - locate('@', reverse(t1.`mysql_user`)))) =
        LEFT(user(),(length(user()) - locate('@', reverse(user())))))
      AND (`app_user_id` IS NULL OR t1.app_user_id = `app_user_id`)
      AND t1.task_type LIKE `task_type`
    ORDER BY t1.id DESC
    LIMIT `limit` OFFSET `offset`
  ) t;

  RETURN tasks;
END $$
DELIMITER ;

-- -----------------------------------------------------
-- Function `mysql_tasks`.`task_list`
-- -----------------------------------------------------
DROP FUNCTION IF EXISTS `mysql_tasks`.`task_list`;
DELIMITER $$
CREATE FUNCTION `mysql_tasks`.`task_list`(
  `task_type` VARCHAR(80),
  `offset` INT UNSIGNED,
  `limit` INT UNSIGNED
)
  RETURNS JSON
  READS SQL DATA
  SQL SECURITY INVOKER
BEGIN
  RETURN (
    SELECT /*+ SET_VAR(use_secondary_engine=off) */
    `mysql_tasks`.`app_task_list`(NULL, `task_type`, `offset`, `limit`)
  );
END $$
DELIMITER ;

-- -----------------------------------------------------
-- Function `mysql_tasks`.`app_task`
-- -----------------------------------------------------
DROP FUNCTION IF EXISTS `mysql_tasks`.`app_task`;
DELIMITER $$
CREATE FUNCTION `mysql_tasks`.`app_task`(
    app_user_id VARCHAR(255),
    id_or_alias VARCHAR(36)
  )
  RETURNS JSON
  READS SQL DATA
  SQL SECURITY DEFINER
BEGIN
  DECLARE tasks JSON DEFAULT NULL;
  DECLARE task_id VARCHAR(36);

  SELECT /*+ SET_VAR(use_secondary_engine=off) */
  `mysql_tasks`.`get_task_id`(id_or_alias) INTO task_id;

  SELECT /*+ SET_VAR(use_secondary_engine=off) */
    JSON_OBJECT(
      'id', BIN_TO_UUID(t.id, 1),
      'alias', t.alias,
      'name', t.name,
      'connection_id', t.connection_id,
      'task_type', t.task_type,
      'data', t.data,
      'data_json_schema', t.data_json_schema,
      'log_data_json_schema', t.log_data_json_schema
  ) INTO tasks
  FROM
    `mysql_tasks`.`task_impl` t
  WHERE
    (LEFT(t.`mysql_user`, (LENGTH(t.`mysql_user`) - locate('@', reverse(t.`mysql_user`)))) =
      LEFT(user(),(length(user()) - locate('@', reverse(user())))))
    AND (`app_user_id` IS NULL OR t.app_user_id = `app_user_id`)
    AND t.id = UUID_TO_BIN(`task_id`, 1);

  RETURN tasks;
END $$
DELIMITER ;

-- -----------------------------------------------------
-- Function `mysql_tasks`.`task`
-- -----------------------------------------------------
DROP FUNCTION IF EXISTS `mysql_tasks`.`task`;
DELIMITER $$
CREATE FUNCTION `mysql_tasks`.`task`(
    id_or_alias VARCHAR(36)
  )
  RETURNS JSON
  READS SQL DATA
  SQL SECURITY DEFINER
BEGIN
  RETURN (
    SELECT `mysql_tasks`.`app_task`(NULL, id_or_alias)
  );
END $$
DELIMITER ;

-- -----------------------------------------------------
-- Function `mysql_tasks`.`app_task_logs`
-- -----------------------------------------------------
DROP FUNCTION IF EXISTS `mysql_tasks`.`app_task_logs`;
DELIMITER $$
CREATE FUNCTION `mysql_tasks`.`app_task_logs`(
    app_user_id VARCHAR(255),
    id_or_alias VARCHAR(36),
    newer_than_log_time TIMESTAMP(6)
  )
  RETURNS JSON
  READS SQL DATA
  SQL SECURITY DEFINER
BEGIN
  DECLARE task_logs JSON DEFAULT NULL;
  DECLARE task_id VARCHAR(36);

  SELECT /*+ SET_VAR(use_secondary_engine=off) */
  `mysql_tasks`.`get_task_id`(id_or_alias) INTO task_id;

  SELECT /*+ SET_VAR(use_secondary_engine=off) */ JSON_ARRAYAGG(
    JSON_OBJECT(
      'id', BIN_TO_UUID(tl.id, 1),
      'task_id', BIN_TO_UUID(tl.task_id, 1),
      'log_time', tl.log_time,
      'message', tl.message,
      'data', tl.data,
      'progress', tl.progress,
      'status', tl.status
  )) INTO task_logs
  FROM
    `mysql_tasks`.`task_log_impl` tl
  JOIN
    `mysql_tasks`.`task_impl` t
  ON
    tl.task_id = t.id
  WHERE
    (LEFT(tl.`mysql_user`, (LENGTH(tl.`mysql_user`) - locate('@', reverse(tl.`mysql_user`)))) =
      LEFT(user(),(length(user()) - locate('@', reverse(user())))))
    AND (`app_user_id` IS NULL OR t.app_user_id = `app_user_id`)
    AND tl.task_id = UUID_TO_BIN(`task_id`, 1)
    AND tl.log_time > COALESCE(unix_timestamp(newer_than_log_time), '1970-01-01')
  ORDER BY tl.log_time DESC;

  RETURN task_logs;
END $$
DELIMITER ;

-- -----------------------------------------------------
-- Function `mysql_tasks`.`task_logs`
-- -----------------------------------------------------
DROP FUNCTION IF EXISTS `mysql_tasks`.`task_logs`;
DELIMITER $$
CREATE FUNCTION `mysql_tasks`.`task_logs`(
    id_or_alias VARCHAR(36),
    newer_than_log_time TIMESTAMP(6)
  )
  RETURNS JSON
  READS SQL DATA
  SQL SECURITY DEFINER
BEGIN
  RETURN (
    SELECT /*+ SET_VAR(use_secondary_engine=off) */
    `mysql_tasks`.`app_task_logs`(NULL, id_or_alias, newer_than_log_time)
  );
END $$
DELIMITER ;

-- -----------------------------------------------------
-- Function `mysql_tasks`.`app_task_status_list`
-- -----------------------------------------------------
DROP FUNCTION IF EXISTS `mysql_tasks`.`app_task_status_list`;
DELIMITER $$
CREATE FUNCTION `mysql_tasks`.`app_task_status_list`(
    `app_user_id` VARCHAR(255),
    `task_type` VARCHAR(80),
    `offset` INT UNSIGNED,
    `limit` INT UNSIGNED
  )
  RETURNS JSON
  READS SQL DATA
  SQL SECURITY DEFINER
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
    SELECT /*+ SET_VAR(use_secondary_engine=off) */ JSON_ARRAYAGG(
      JSON_OBJECT(
        'id', sq.id,
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
        'row_hash', MD5(CONCAT_WS(',',
            sq.status, sq.message, sq.progress, sq.data, sq.log_data, sq.scheduled_time,
            sq.starting_time, sq.estimated_completion_time, sq.estimated_remaining_time
          )
        )
      )
    )
    FROM (
      SELECT * FROM
        `mysql_tasks`.`task_status_impl` tsi
      WHERE
        LEFT(tsi.mysql_user, LENGTH(tsi.mysql_user) - LOCATE('@', REVERSE(tsi.mysql_user))) =
        LEFT(SESSION_USER(), LENGTH(SESSION_USER()) - LOCATE('@', REVERSE(SESSION_USER())))
        AND (`app_user_id` IS NULL OR tsi.app_user_id = `app_user_id`)
        AND tsi.task_type LIKE `task_type`
      ORDER BY tsi.id DESC
      LIMIT `limit` OFFSET `offset`
    ) sq
  );
END $$
DELIMITER ;

-- -----------------------------------------------------
-- Function `mysql_tasks`.`task_status_list`
-- -----------------------------------------------------
DROP FUNCTION IF EXISTS `mysql_tasks`.`task_status_list`;
DELIMITER $$
CREATE FUNCTION `mysql_tasks`.`task_status_list`(
    `task_type` VARCHAR(80),
    `offset` INT UNSIGNED,
    `limit` INT UNSIGNED
  )
  RETURNS JSON
  READS SQL DATA
  SQL SECURITY DEFINER
BEGIN
  RETURN (
    SELECT /*+ SET_VAR(use_secondary_engine=off) */
    `mysql_tasks`.`app_task_status_list`(NULL, `task_type`, `offset`, `limit`)
  );
END $$
DELIMITER ;

-- -----------------------------------------------------
-- Function `mysql_tasks`.`app_task_status`
-- -----------------------------------------------------
DROP FUNCTION IF EXISTS `mysql_tasks`.`app_task_status`;
DELIMITER $$
CREATE FUNCTION `mysql_tasks`.`app_task_status`(
    app_user_id VARCHAR(255),
    id_or_alias VARCHAR(36)
  )
  RETURNS JSON
  READS SQL DATA
  SQL SECURITY DEFINER
BEGIN
  DECLARE task_id VARCHAR(36);

  SELECT /*+ SET_VAR(use_secondary_engine=off) */
  `mysql_tasks`.`get_task_id`(id_or_alias) INTO task_id;

  RETURN (
    SELECT /*+ SET_VAR(use_secondary_engine=off) */
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
        'row_hash', MD5(CONCAT_WS(',',
            sq.status, sq.message, sq.progress, sq.data, sq.log_data, sq.scheduled_time,
            sq.starting_time, sq.estimated_completion_time, sq.estimated_remaining_time
          )
        )
      )
    FROM (
      SELECT * FROM
        `mysql_tasks`.`task_status_impl` tsi
      WHERE
        LEFT(tsi.mysql_user, LENGTH(tsi.mysql_user) - LOCATE('@', REVERSE(tsi.mysql_user))) =
        LEFT(SESSION_USER(), LENGTH(SESSION_USER()) - LOCATE('@', REVERSE(SESSION_USER())))
        AND (`app_user_id` IS NULL OR tsi.app_user_id = `app_user_id`)
        AND tsi.id = UUID_TO_BIN(`task_id`, 1)
    ) sq
  );
END $$
DELIMITER ;

-- -----------------------------------------------------
-- Function `mysql_tasks`.`task_status`
-- -----------------------------------------------------
DROP FUNCTION IF EXISTS `mysql_tasks`.`task_status`;
DELIMITER $$
CREATE FUNCTION `mysql_tasks`.`task_status`(
    id_or_alias VARCHAR(36)
  )
  RETURNS JSON
  READS SQL DATA
  SQL SECURITY DEFINER
BEGIN
  RETURN (
    SELECT /*+ SET_VAR(use_secondary_engine=off) */
    `mysql_tasks`.`app_task_status`(NULL, id_or_alias)
  );
END $$
DELIMITER ;

-- -----------------------------------------------------
-- Function `mysql_tasks`.`app_task_status_brief`
-- -----------------------------------------------------
DROP FUNCTION IF EXISTS `mysql_tasks`.`app_task_status_brief`;
DELIMITER $$
CREATE FUNCTION `mysql_tasks`.`app_task_status_brief`(
    app_user_id VARCHAR(255),
    id_or_alias VARCHAR(36)
  )
  RETURNS JSON
  READS SQL DATA
  SQL SECURITY DEFINER
BEGIN

  DECLARE task_id VARCHAR(36);

  SELECT /*+ SET_VAR(use_secondary_engine=off) */
  `mysql_tasks`.`get_task_id`(id_or_alias) INTO task_id;

  RETURN (
    SELECT /*+ SET_VAR(use_secondary_engine=off) */
      JSON_OBJECT(
        'data', sq.log_data,
        'message', sq.message,
        'progress', sq.progress,
        'status', sq.status
      )
    FROM (
      SELECT * FROM
        `mysql_tasks`.`task_status_impl` tsi
      WHERE
        LEFT(tsi.mysql_user, LENGTH(tsi.mysql_user) - LOCATE('@', REVERSE(tsi.mysql_user))) =
        LEFT(SESSION_USER(), LENGTH(SESSION_USER()) - LOCATE('@', REVERSE(SESSION_USER())))
        AND (`app_user_id` IS NULL OR tsi.app_user_id = `app_user_id`)
        AND tsi.id = UUID_TO_BIN(`task_id`, 1)
      LIMIT 1
    ) sq
  );
END $$
DELIMITER ;

-- -----------------------------------------------------
-- Function `mysql_tasks`.`task_status_brief`
-- -----------------------------------------------------
DROP FUNCTION IF EXISTS `mysql_tasks`.`task_status_brief`;
DELIMITER $$
CREATE FUNCTION `mysql_tasks`.`task_status_brief`(
    id_or_alias VARCHAR(36)
  )
  RETURNS JSON
  READS SQL DATA
  SQL SECURITY DEFINER
BEGIN
  RETURN (
    SELECT /*+ SET_VAR(use_secondary_engine=off) */
    `mysql_tasks`.`app_task_status_brief`(NULL, id_or_alias)
  );
END $$
DELIMITER ;

-- -----------------------------------------------------
-- Function `mysql_tasks`.`find_task_log_msg`
--   for internal use
-- -----------------------------------------------------
DROP FUNCTION IF EXISTS `mysql_tasks`.`find_task_log_msg`;
DELIMITER $$
CREATE FUNCTION `mysql_tasks`.`find_task_log_msg`(
    task_id VARCHAR(36),
    log_msg TEXT
  )
  RETURNS JSON
  READS SQL DATA
  SQL SECURITY DEFINER
BEGIN
  DECLARE task_log JSON DEFAULT NULL;

  SELECT /*+ SET_VAR(use_secondary_engine=off) */ JSON_OBJECT(
    'id', BIN_TO_UUID(tl.id, 1),
    'log_time', tl.log_time,
    'data', tl.data,
    'progress', tl.progress,
    'status', tl.status
  ) INTO task_log
  FROM `mysql_tasks`.`task_log_impl` tl
  WHERE
    tl.task_id = UUID_TO_BIN(`task_id`, 1)
    AND tl.message = log_msg;

  RETURN task_log;
END $$
DELIMITER ;

-- -----------------------------------------------------
-- Function `mysql_tasks`.`get_task_log_data_json_schema`
--   for internal use
-- -----------------------------------------------------
DROP FUNCTION IF EXISTS `mysql_tasks`.`get_task_log_data_json_schema`;
DELIMITER $$
CREATE FUNCTION `mysql_tasks`.`get_task_log_data_json_schema`(
    task_id VARCHAR(36)
  )
  RETURNS JSON
  READS SQL DATA
  SQL SECURITY DEFINER
BEGIN
  RETURN (
    SELECT /*+ SET_VAR(use_secondary_engine=off) */
      t.log_data_json_schema
    FROM `mysql_tasks`.`task_impl` t
    WHERE
      t.id = UUID_TO_BIN(`task_id`, 1)
  );
END $$
DELIMITER ;

-- -----------------------------------------------------
-- Function `mysql_tasks`.`get_task_connection_id`
--   for internal use
-- -----------------------------------------------------
DROP FUNCTION IF EXISTS `mysql_tasks`.`get_task_connection_id`;
DELIMITER $$
CREATE FUNCTION `mysql_tasks`.`get_task_connection_id`(
    task_id VARCHAR(36)
  )
  RETURNS BIGINT UNSIGNED
  READS SQL DATA
  SQL SECURITY DEFINER
BEGIN
  RETURN (
    SELECT /*+ SET_VAR(use_secondary_engine=off) */
      t.connection_id
    FROM `mysql_tasks`.`task_impl` t
    WHERE
      t.id = UUID_TO_BIN(`task_id`, 1)
  );
END $$
DELIMITER ;

-- -----------------------------------------------------
-- Function `mysql_tasks`.`active_task_count`
--   for internal use
-- -----------------------------------------------------
DROP FUNCTION IF EXISTS `mysql_tasks`.`active_task_count`;
DELIMITER $$
CREATE FUNCTION `mysql_tasks`.`active_task_count`()
  RETURNS INT UNSIGNED
  READS SQL DATA
  SQL SECURITY DEFINER
BEGIN
  RETURN (
    SELECT /*+ SET_VAR(use_secondary_engine=off) */
    COUNT(active_task.task_id) FROM (
      SELECT
        DISTINCT(tl.task_id) AS task_id
      FROM
        `mysql_tasks`.`task_log_impl` tl
      JOIN
        `mysql_tasks`.`task_impl` t
      ON
        tl.task_id = t.id
      WHERE
        tl.status IN ('RUNNING', 'SCHEDULED')
      AND tl.task_id NOT IN (
        SELECT DISTINCT(tli.task_id)
        FROM
          `mysql_tasks`.`task_log_impl` tli
        WHERE
          tli.status IN ('COMPLETED', 'ERROR', 'CANCELLED')
      )
    ) active_task
  );
END $$
DELIMITER ;

-- -----------------------------------------------------
-- Function `mysql_tasks`.`get_app_task_ids_from_alias`
-- -----------------------------------------------------
DROP FUNCTION IF EXISTS `mysql_tasks`.`get_app_task_ids_from_alias`;
DELIMITER $$
CREATE FUNCTION `mysql_tasks`.`get_app_task_ids_from_alias`(
    app_user_id VARCHAR(255),
    alias VARCHAR(16)
  )
  RETURNS JSON
  READS SQL DATA
  SQL SECURITY DEFINER
BEGIN
  RETURN (
    SELECT /*+ SET_VAR(use_secondary_engine=off) */ JSON_ARRAYAGG(
      BIN_TO_UUID(t.id, 1)
    )
    FROM
      `mysql_tasks`.`task_impl` t
    WHERE
      LEFT(t.mysql_user, LENGTH(t.mysql_user) - LOCATE('@', REVERSE(t.mysql_user))) =
      LEFT(SESSION_USER(), LENGTH(SESSION_USER()) - LOCATE('@', REVERSE(SESSION_USER())))
      AND (`app_user_id` IS NULL OR t.app_user_id = `app_user_id`)
      AND t.alias = alias
  );
END $$
DELIMITER ;

-- -----------------------------------------------------
-- Function `mysql_tasks`.`get_task_ids_from_alias`
-- -----------------------------------------------------
DROP FUNCTION IF EXISTS `mysql_tasks`.`get_task_ids_from_alias`;
DELIMITER $$
CREATE FUNCTION `mysql_tasks`.`get_task_ids_from_alias`(
    alias VARCHAR(16)
  )
  RETURNS JSON
  READS SQL DATA
  SQL SECURITY DEFINER
BEGIN
  RETURN (
    SELECT /*+ SET_VAR(use_secondary_engine=off) */
    `mysql_tasks`.`get_app_task_ids_from_alias`(NULL, alias)
  );
END $$
DELIMITER ;

-- -----------------------------------------------------
-- Function `mysql_tasks`.`get_app_task_id`
--   for internal use
-- -----------------------------------------------------
DROP FUNCTION IF EXISTS `mysql_tasks`.`get_app_task_id`;
DELIMITER $$
CREATE FUNCTION `mysql_tasks`.`get_app_task_id`(
    app_user_id VARCHAR(255),
    id_or_alias VARCHAR(36)
  )
  RETURNS VARCHAR(36)
  READS SQL DATA
  SQL SECURITY INVOKER
BEGIN
  DECLARE task_ids JSON;
  DECLARE task_id VARCHAR(36);

  IF (CHAR_LENGTH(id_or_alias) = 36) THEN
    -- If argument has the exact length of UUID, assume task_id is provided
    SELECT id_or_alias INTO task_id;
  ELSE
    -- Otherwise, assume alias is provided

    -- Replace task_alias with task_id
    SELECT /*+ SET_VAR(use_secondary_engine=off) */
    `mysql_tasks`.`get_app_task_ids_from_alias`(app_user_id, id_or_alias) INTO task_ids;

    IF JSON_LENGTH(task_ids) > 1 THEN
      SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'Multiple tasks for this alias, re-run using a task_id. For a list IDs: SELECT mysql_tasks.get_task_ids_from_alias(alias);';
    END IF;

    SELECT task_ids->>'$[0]' INTO task_id;
  END IF;

  RETURN task_id;
END $$
DELIMITER ;

-- -----------------------------------------------------
-- Function `mysql_tasks`.`get_task_id`
-- -----------------------------------------------------
DROP FUNCTION IF EXISTS `mysql_tasks`.`get_task_id`;
DELIMITER $$
CREATE FUNCTION `mysql_tasks`.`get_task_id`(
    id_or_alias VARCHAR(36)
  )
  RETURNS VARCHAR(36)
  READS SQL DATA
  SQL SECURITY INVOKER
BEGIN
  RETURN (
    SELECT /*+ SET_VAR(use_secondary_engine=off) */
    `mysql_tasks`.`get_app_task_id`(NULL, id_or_alias)
  );
END $$
DELIMITER ;

-- -----------------------------------------------------
-- Function `mysql_tasks`.`get_app_task_alias`
-- -----------------------------------------------------
DROP FUNCTION IF EXISTS `mysql_tasks`.`get_app_task_alias`;
DELIMITER $$
CREATE FUNCTION `mysql_tasks`.`get_app_task_alias`(
    app_user_id VARCHAR(255),
    id VARCHAR(36)
  )
  RETURNS VARCHAR(16)
  READS SQL DATA
  SQL SECURITY INVOKER
BEGIN
  DECLARE task_info JSON;
  SELECT /*+ SET_VAR(use_secondary_engine=off) */
  `mysql_tasks`.`app_task`(app_user_id, id) INTO task_info;
  RETURN task_info->>'$.alias';
END $$
DELIMITER ;

-- -----------------------------------------------------
-- Function `mysql_tasks`.`get_task_alias`
-- -----------------------------------------------------
DROP FUNCTION IF EXISTS `mysql_tasks`.`get_task_alias`;
DELIMITER $$
CREATE FUNCTION `mysql_tasks`.`get_task_alias`(
    id VARCHAR(36)
  )
  RETURNS VARCHAR(16)
  READS SQL DATA
  SQL SECURITY INVOKER
BEGIN
  RETURN (
    SELECT /*+ SET_VAR(use_secondary_engine=off) */
    `mysql_tasks`.`get_app_task_alias`(NULL, id)
  );
END $$
DELIMITER ;

-- -----------------------------------------------------
-- Procedure `mysql_tasks`.`create_app_task`
-- -----------------------------------------------------
DROP PROCEDURE IF EXISTS `mysql_tasks`.`create_app_task`;
DELIMITER $$
CREATE PROCEDURE `mysql_tasks`.`create_app_task`(
  IN `app_user_id` VARCHAR(255),
	IN `name` VARCHAR(255), IN `task_type` VARCHAR(45), IN `data` JSON,
  IN `data_json_schema` JSON, IN `log_data_json_schema` JSON,
  OUT `task_id` VARCHAR(36))
SQL SECURITY INVOKER
BEGIN
  SET task_id = UUID();
  CALL `mysql_tasks`.`create_app_task_with_id`(`app_user_id`, task_id, `name`, task_type, `data`, `data_json_schema`, `log_data_json_schema`);
END$$
DELIMITER ;

-- -----------------------------------------------------
-- Procedure `mysql_tasks`.`create_app_task_with_id`
-- -----------------------------------------------------
DROP PROCEDURE IF EXISTS `mysql_tasks`.`create_app_task_with_id`;
DELIMITER $$
CREATE PROCEDURE `mysql_tasks`.`create_app_task_with_id`(
  IN `app_user_id` VARCHAR(255),
  IN `id` VARCHAR(36), IN `name` VARCHAR(255), IN `task_type` VARCHAR(45), IN `data` JSON,
  IN `data_json_schema` JSON, IN `log_data_json_schema` JSON)
SQL SECURITY INVOKER
BEGIN
  -- insert entry into task table
  INSERT INTO `mysql_tasks`.`task_i`(`id`, `app_user_id`, `server_uuid`, `name`, `connection_id`, `task_type`, `data`, `data_json_schema`, `log_data_json_schema`)
    VALUES (UUID_TO_BIN(id, 1), app_user_id, UUID_TO_BIN(@@server_uuid, 1), `name`, CONNECTION_ID(), task_type, `data`, `data_json_schema`, `log_data_json_schema`);

  IF `data_json_schema` IS NOT NULL AND NOT JSON_SCHEMA_VALID(`data_json_schema`, `data`) THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'The provided task data does not conform to the given data_json_schema.',
      MYSQL_ERRNO = 5400;
  END IF;

  CALL `mysql_tasks`.`add_task_log`(id, 'Task created by user.', NULL, 0, 'SCHEDULED');
END$$
DELIMITER ;

-- -----------------------------------------------------
-- Procedure `mysql_tasks`.`create_task`
-- -----------------------------------------------------
DROP PROCEDURE IF EXISTS `mysql_tasks`.`create_task`;
DELIMITER $$
CREATE PROCEDURE `mysql_tasks`.`create_task`(
	IN `name` VARCHAR(255), IN `task_type` VARCHAR(45), IN `data` JSON, OUT `task_id` VARCHAR(36))
SQL SECURITY INVOKER
BEGIN
  CALL `mysql_tasks`.`create_app_task`(NULL, `name`, task_type, `data`, NULL, NULL, `task_id`);
END$$
DELIMITER ;

-- -----------------------------------------------------
-- Procedure `mysql_tasks`.`create_task_with_id`
-- -----------------------------------------------------
DROP PROCEDURE IF EXISTS `mysql_tasks`.`create_task_with_id`;
DELIMITER $$
CREATE PROCEDURE `mysql_tasks`.`create_task_with_id`(
  IN `id` VARCHAR(36), IN `name` VARCHAR(255), IN `task_type` VARCHAR(45), IN `data` JSON)
SQL SECURITY INVOKER
BEGIN
  CALL `mysql_tasks`.`create_app_task_with_id`(NULL, `id`, `name`, `task_type`, `data`, NULL, NULL);
END$$
DELIMITER ;

-- -----------------------------------------------------
-- Procedure `mysql_tasks`.`add_task_log`
-- -----------------------------------------------------
DROP PROCEDURE IF EXISTS `mysql_tasks`.`add_task_log`;
DELIMITER $$
CREATE PROCEDURE `mysql_tasks`.`add_task_log`(
  IN `task_id` VARCHAR(36), IN `message` VARCHAR(2000), IN `data` JSON,
  IN `progress` SMALLINT, IN `status` ENUM('SCHEDULED', 'RUNNING', 'COMPLETED', 'ERROR', 'CANCELLED'))
SQL SECURITY INVOKER
BEGIN
  DECLARE log_id BINARY(16) DEFAULT UUID_TO_BIN(UUID(), 1);
  DECLARE log_data_json_schema JSON DEFAULT NULL;

  SELECT /*+ SET_VAR(use_secondary_engine=off) */
  `mysql_tasks`.`get_task_log_data_json_schema`(task_id) INTO log_data_json_schema;

  IF `log_data_json_schema` IS NOT NULL AND NOT JSON_SCHEMA_VALID(`log_data_json_schema`, `data`) THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'The provided log data does not conform to the given log_data_json_schema.',
      MYSQL_ERRNO = 5400;
  END IF;

  INSERT INTO `mysql_tasks`.`task_log_i` (`id`, `task_id`, `log_time`, `message`, `data`, `progress`, `status`)
    VALUES (log_id, UUID_TO_BIN(task_id, 1), NOW(6), message, `data`, progress, `status`);
END$$
DELIMITER ;

-- -----------------------------------------------------
-- Procedure `mysql_tasks`.`kill_app_task`
-- -----------------------------------------------------
DROP PROCEDURE IF EXISTS `mysql_tasks`.`kill_app_task`;
DELIMITER $$
CREATE PROCEDURE `mysql_tasks`.`kill_app_task`(IN `app_user_id` VARCHAR(255), IN `id_or_alias` VARCHAR(36))
    SQL SECURITY INVOKER
BEGIN
  DECLARE task_id VARCHAR(36);
  DECLARE task_status JSON DEFAULT NULL;

  DECLARE status TEXT DEFAULT NULL;
  DECLARE suuid VARCHAR(36) DEFAULT NULL;
  DECLARE cid BIGINT UNSIGNED DEFAULT NULL;
  DECLARE i INT DEFAULT 0;
  DECLARE event_name TEXT DEFAULT NULL;

  SELECT /*+ SET_VAR(use_secondary_engine=off) */
  `mysql_tasks`.`get_app_task_id`(app_user_id, id_or_alias) INTO task_id;

  SELECT /*+ SET_VAR(use_secondary_engine=off) */
  `mysql_tasks`.`app_task_status`(app_user_id, task_id) INTO task_status;

  IF task_status IS NULL THEN
    SIGNAL SQLSTATE '45000'
    SET MESSAGE_TEXT = 'Task does not exist or not allowed to access it.';
  END IF;

  SET status = JSON_UNQUOTE(JSON_EXTRACT(task_status, '$.status'));
  SET suuid = JSON_UNQUOTE(JSON_EXTRACT(task_status, '$.server_uuid'));
  SET cid = JSON_UNQUOTE(JSON_EXTRACT(task_status, '$.connection_id'));

  IF suuid <> @@server_uuid THEN
    SIGNAL SQLSTATE '45000'
    SET MESSAGE_TEXT = 'Tasks started on other servers cannot be killed.';
  END IF;

  IF (status <> 'RUNNING' AND status <> 'SCHEDULED') THEN
    SIGNAL SQLSTATE '45000'
    SET MESSAGE_TEXT = 'Task inactive.';
  END IF;

  -- kill process
  SET @stmt = CONCAT('KILL ', cid);
  PREPARE stmt FROM @stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

  -- drop associated events
  IF JSON_CONTAINS_PATH(task_status, 'one', '$.task_data.mysqlMetadata.events') THEN
    WHILE i < JSON_LENGTH(task_status->'$.task_data.mysqlMetadata.events') DO
      SET event_name = JSON_UNQUOTE(JSON_EXTRACT(task_status->'$.task_data.mysqlMetadata.events', CONCAT('$[',i,']')));
      CALL `mysql_tasks`.`drop_event`(event_name);
      SELECT i+1 INTO i;
    END WHILE;
  END IF;

  CALL `mysql_tasks`.`add_task_log`(task_id, 'Cancelled by user.', NULL, 100, 'CANCELLED');

END$$
DELIMITER ;

-- -----------------------------------------------------
-- Procedure `mysql_tasks`.`kill_task`
-- -----------------------------------------------------
DROP PROCEDURE IF EXISTS `mysql_tasks`.`kill_task`;
DELIMITER $$
CREATE PROCEDURE `mysql_tasks`.`kill_task`(IN `id_or_alias` VARCHAR(36))
    SQL SECURITY INVOKER
BEGIN
  CALL `mysql_tasks`.`kill_app_task`(NULL, id_or_alias);
END$$
DELIMITER ;

-- -----------------------------------------------------
-- Procedure `mysql_tasks`.`drop_event`
-- -----------------------------------------------------
DROP PROCEDURE IF EXISTS `mysql_tasks`.`drop_event`;
DELIMITER $$
CREATE PROCEDURE `mysql_tasks`.`drop_event`(IN `event_name` TEXT)
  SQL SECURITY INVOKER
BEGIN
  DECLARE event_cmnt TEXT DEFAULT NULL;
  DECLARE version_string VARCHAR(255);
  DECLARE major INT UNSIGNED;
  DECLARE minor INT UNSIGNED;
  DECLARE patch INT UNSIGNED;
  DECLARE task_mgmt_major INT UNSIGNED;
  DECLARE task_mgmt_minor INT UNSIGNED;
  DECLARE task_mgmt_patch INT UNSIGNED;

  -- get schema version
  SELECT
    /*+ SET_VAR(use_secondary_engine=off) */
    v.major, v.minor, v.patch INTO task_mgmt_major, task_mgmt_minor, task_mgmt_patch
  FROM
    `mysql_tasks`.`schema_version` v;

  -- get comment from the runner event
  SELECT
    /*+ SET_VAR(use_secondary_engine=off) */
    EVENT_COMMENT INTO event_cmnt
  FROM
    information_schema.events e
  WHERE
    CONCAT(mysql_tasks.quote_identifier(e.EVENT_SCHEMA), '.', mysql_tasks.quote_identifier(e.EVENT_NAME)) = `event_name`
    AND e.EVENT_COMMENT LIKE 'mysql_tasks_schema_version=%';

  SET version_string = SUBSTRING_INDEX(event_cmnt, 'mysql_tasks_schema_version=', -1); -- Get the part after "="
  SET major = CAST(SUBSTRING_INDEX(version_string, '.', 1) AS UNSIGNED);
  SET minor = CAST(SUBSTRING_INDEX(SUBSTRING_INDEX(version_string, '.', 2), '.', -1) AS UNSIGNED);
  SET patch = CAST(SUBSTRING_INDEX(version_string, '.', -1) AS UNSIGNED);

  -- drop event if it has the comment with the supported version
  IF (event_cmnt IS NOT NULL)
    AND (major < task_mgmt_major OR (major = task_mgmt_major
    AND (minor < task_mgmt_minor OR (minor = task_mgmt_minor
    AND patch <= task_mgmt_patch))))
  THEN
    SET @stmt = CONCAT('DROP EVENT IF EXISTS ', event_name);
    PREPARE stmt FROM @stmt;
    EXECUTE stmt;
    DEALLOCATE PREPARE stmt;
  END IF;

END $$
DELIMITER ;

-- -----------------------------------------------------
-- Procedure `mysql_tasks`.`execute_prepared_stmt_from_app_async`
-- -----------------------------------------------------
DROP PROCEDURE IF EXISTS `mysql_tasks`.`execute_prepared_stmt_from_app_async`;
DELIMITER $$
CREATE PROCEDURE `mysql_tasks`.`execute_prepared_stmt_from_app_async`(
  IN `sql_statements` TEXT,
  IN `app_user_id` VARCHAR(255),
  IN `schema_name` VARCHAR(255),
  IN `task_name` VARCHAR(45),
  IN `task_data` JSON,
  IN `data_json_schema` JSON,
  IN `log_data_json_schema` JSON,
  IN `progress_monitor_sql_statements` TEXT,
  OUT task_id VARCHAR(36))
  SQL SECURITY INVOKER
BEGIN
  DECLARE event_name, progress_event_name TEXT DEFAULT NULL;
  DECLARE task_mgmt_version TEXT DEFAULT NULL;
  DECLARE max_parallel_tasks INT UNSIGNED DEFAULT NULL;
  DECLARE active_task_cnt INT UNSIGNED DEFAULT NULL;
  DECLARE internal_data JSON DEFAULT NULL;
  DECLARE internal_data_json_schema JSON DEFAULT NULL;
  DECLARE data_json_schema_required JSON DEFAULT NULL;

  DECLARE EXIT HANDLER FOR SQLEXCEPTION
  BEGIN
      GET DIAGNOSTICS CONDITION 1 @p1 = RETURNED_SQLSTATE, @p2 = MYSQL_ERRNO, @p3 = MESSAGE_TEXT;
      SELECT RELEASE_LOCK('execute_prepared_stmt_async') INTO @__lock;
      SET @__lock = NULL;
      IF @p3 = 'No schema set.' THEN
        SIGNAL SQLSTATE '45000'
          SET MESSAGE_TEXT = 'No schema set. Please pass in the schema name or set the current schema with USE.',
          MYSQL_ERRNO = 5400;
      ELSE
        RESIGNAL;
      END IF;
  END;

  SELECT
    /*+ SET_VAR(use_secondary_engine=off) */
    JSON_EXTRACT(data, '$.limits.maximumPreparedStmtAsyncTasks') INTO max_parallel_tasks
  FROM
    `mysql_tasks`.`config`
  WHERE id = 1
  LIMIT 1;

  IF task_name IS NULL THEN
    SET task_name = 'execute_prepared_stmt_async';
  END IF;

  IF schema_name IS NULL THEN
    SELECT
      /*+ SET_VAR(use_secondary_engine=off) */
      current_schema INTO schema_name
    FROM
      `performance_schema`.`events_statements_current`
    WHERE
      thread_id=PS_CURRENT_THREAD_ID()
      AND nesting_event_level=0;
  END IF;
  IF schema_name IS NULL THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'No schema set.', MYSQL_ERRNO = 5400;
  END IF;

  -- ensure the SQL statements end with a semicolon
  IF NOT REGEXP_LIKE(sql_statements, ';[:space:]*$') THEN
    SET sql_statements = CONCAT(sql_statements, '; ');
  END IF;

  -- make sure the reserved property is not used
  IF JSON_CONTAINS_PATH(data_json_schema, 'one', '$.properties.mysqlMetadata') THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'data_json_schema must not contain a reserved property "mysqlMetadata".', MYSQL_ERRNO = 5400;
  END IF;

  SET internal_data_json_schema = JSON_OBJECT(
    "type", "object",
    "properties", JSON_OBJECT(
      "mysqlMetadata", JSON_OBJECT(
        "type", "object",
        "properties", JSON_OBJECT(
          "events", JSON_OBJECT(
            "type", "array",
            "items", JSON_OBJECT(
              "type", "string"
            ),
            "minItems", 1,
            "uniqueItems", true
          ),
          "autoGc", JSON_OBJECT(
            "type", "boolean"
          )
        ),
        "required", JSON_ARRAY("events", "autoGc")
      )
    ),
    "required", JSON_ARRAY("mysqlMetadata")
  );

  -- merge the provided schema and the internal schema
  SET data_json_schema = COALESCE(data_json_schema, JSON_OBJECT("required", JSON_ARRAY()));
  SELECT JSON_UNQUOTE(JSON_MERGE_PRESERVE(JSON_EXTRACT(internal_data_json_schema, '$.required'), JSON_EXTRACT(data_json_schema, '$.required'))) INTO data_json_schema_required;
  SET data_json_schema = JSON_MERGE_PATCH(internal_data_json_schema, data_json_schema);
  SET data_json_schema = JSON_SET(data_json_schema, '$.required', data_json_schema_required);

  SELECT /*+ SET_VAR(use_secondary_engine=off) */ CONCAT(mysql_tasks.quote_identifier(schema_name), '.', mysql_tasks.quote_identifier(UUID())) INTO event_name;
  SELECT /*+ SET_VAR(use_secondary_engine=off) */ CONCAT(mysql_tasks.quote_identifier(schema_name), '.', mysql_tasks.quote_identifier(UUID())) INTO progress_event_name;
  SELECT /*+ SET_VAR(use_secondary_engine=off) */ CONCAT(major, '.', minor, '.', patch) FROM `mysql_tasks`.`schema_version` INTO task_mgmt_version;

  SET internal_data = JSON_OBJECT(
    "mysqlMetadata", JSON_OBJECT(
      "events", IF (progress_monitor_sql_statements IS NULL, JSON_ARRAY(event_name), JSON_ARRAY(event_name, progress_event_name)),
      "autoGc", true
    )
  );

  -- make sure reserved property is not used
  IF JSON_CONTAINS_PATH(task_data, 'one', '$.mysqlMetadata') THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'task_data must not contain a reserved property "mysqlMetadata".', MYSQL_ERRNO = 5400;
  END IF;

  -- merge the provided task data and the internal metadata
  SET task_data = COALESCE(task_data, JSON_OBJECT());
  SET task_data = JSON_MERGE_PATCH(internal_data, task_data);

  SELECT GET_LOCK('execute_prepared_stmt_async', 2) INTO @__lock;
  IF @__lock = 0 THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Cannot acquire lock. Try again later', MYSQL_ERRNO = 5400;
  END IF;

  -- READ COMMITTED does not acquire lock on the task_log table,
  -- avoiding a potential deadlock between this SELECT and INSERTS in concurrent events
  SET TRANSACTION ISOLATION LEVEL READ COMMITTED;
  SELECT /*+ SET_VAR(use_secondary_engine=off) */ `mysql_tasks`.`active_task_count`() INTO active_task_cnt;
  COMMIT ;

  IF active_task_cnt >= max_parallel_tasks THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Maximum number of parallel tasks reached, try again later.', MYSQL_ERRNO = 5400;
  END IF;

  SET task_id = UUID();

  SET @eventSql = CONCAT(
    'CREATE EVENT ', event_name, ' ',
    'ON SCHEDULE AT NOW() ON COMPLETION NOT PRESERVE ENABLE ',
    'COMMENT "mysql_tasks_schema_version=', task_mgmt_version, '" ',
    'DO BEGIN ',
    'DECLARE EXIT HANDLER FOR SQLEXCEPTION BEGIN ',
    '  GET DIAGNOSTICS CONDITION 1 @p1 = RETURNED_SQLSTATE, @p2 = MYSQL_ERRNO, @p3 = MESSAGE_TEXT; ',
    '  CALL `mysql_tasks`.`stop_task_monitor`(', QUOTE(progress_event_name), '); ',
    '  CALL `mysql_tasks`.`add_task_log`("', task_id, '", CONCAT("Error: ", @p3), NULL, 100, "ERROR"); ',
    'END; ',
    'SET ROLE ALL; ',
    'SET @task_id ="', task_id, '"; SET @task_result = NULL; ',

    'CALL `mysql_tasks`.`create_app_task_with_id`(',
      IF(app_user_id IS NULL, 'NULL', QUOTE(app_user_id)),
      ', @task_id, ',
      QUOTE(task_name), ', ',
      '"Async_SQL", ',
      QUOTE(task_data), ', ',
      QUOTE(data_json_schema), ', ',
      QUOTE(log_data_json_schema),
    '); ',

    'CALL `mysql_tasks`.`start_task_monitor`(',
      QUOTE(progress_event_name), ', ',
      QUOTE(task_id), ', ',
      QUOTE(progress_monitor_sql_statements),
    '); '

    'CALL `mysql_tasks`.`add_task_log`(@task_id, "Event execution started...", NULL, 0, "RUNNING"); ',
    sql_statements,

    'CALL `mysql_tasks`.`stop_task_monitor`(', QUOTE(progress_event_name), '); ',
    'CALL `mysql_tasks`.`add_task_log`(@task_id, "Execution finished.", CAST(@task_result AS JSON), 100, "COMPLETED"); ',
    'END;');

  PREPARE dynamic_statement FROM @eventSql;
  EXECUTE dynamic_statement;
  DEALLOCATE PREPARE dynamic_statement;

  SELECT RELEASE_LOCK('execute_prepared_stmt_async') INTO @__lock;
  SET @__lock = NULL;
END$$
DELIMITER ;

-- -----------------------------------------------------
-- Procedure `mysql_tasks`.`execute_prepared_stmt_async`
-- -----------------------------------------------------
DROP PROCEDURE IF EXISTS `mysql_tasks`.`execute_prepared_stmt_async`;
DELIMITER $$
CREATE PROCEDURE `mysql_tasks`.`execute_prepared_stmt_async`(
  IN `sql_statements` TEXT,
  IN `schema_name` VARCHAR(255),
  IN `task_name` VARCHAR(45),
  IN `task_data` JSON,
  OUT task_id VARCHAR(36))
  SQL SECURITY INVOKER
BEGIN
  CALL `mysql_tasks`.`execute_prepared_stmt_from_app_async`(
    `sql_statements`, NULL, `schema_name`, `task_name`, `task_data`, NULL, NULL, NULL, task_id);
END$$
DELIMITER ;

-- -----------------------------------------------------
-- Procedure `mysql_tasks`.`start_task_monitor`
-- -----------------------------------------------------
DROP PROCEDURE IF EXISTS `mysql_tasks`.`start_task_monitor`;
DELIMITER $$
CREATE PROCEDURE `mysql_tasks`.`start_task_monitor`(
  IN `event_name` TEXT,
  IN `task_id` VARCHAR(36),
  IN `sql_statements` TEXT
)
SQL SECURITY INVOKER
BEGIN
  DECLARE task_mgmt_version TEXT DEFAULT NULL;

  IF sql_statements IS NOT NULL THEN
    SELECT /*+ SET_VAR(use_secondary_engine=off) */
      CONCAT(major, '.', minor, '.', patch)
    FROM
      `mysql_tasks`.`schema_version` INTO task_mgmt_version;

    -- ensure the SQL statements end with a semicolon
    IF NOT REGEXP_LIKE(sql_statements, ';[:space:]*$') THEN
      SET sql_statements = CONCAT(sql_statements, '; ');
    END IF;

    SET @eventSql = CONCAT(
      'CREATE EVENT ', event_name, ' ON SCHEDULE EVERY 5 SECOND ',
      'COMMENT "mysql_tasks_schema_version=', task_mgmt_version, '" ',
      'DO BEGIN ',
      'DECLARE EXIT HANDLER FOR SQLEXCEPTION BEGIN ',
      '  GET DIAGNOSTICS CONDITION 1 @p1 = RETURNED_SQLSTATE, @p2 = MYSQL_ERRNO, @p3 = MESSAGE_TEXT; ',
      '  CALL `mysql_tasks`.`add_task_log`(', QUOTE(task_id),', CONCAT("Error: ", @p3), NULL, 100, "ERROR"); ',
      'END; ',
      'SET ROLE ALL; ',
      'SET @task_id =', QUOTE(task_id), '; ',
      sql_statements,
      'END'
    );

    PREPARE dynamic_statement FROM @eventSql;
    EXECUTE dynamic_statement;
    DEALLOCATE PREPARE dynamic_statement;

  END IF;
END$$
DELIMITER ;

-- -----------------------------------------------------
-- Set the schema_version VIEW to the correct version at the very end
CREATE OR REPLACE SQL SECURITY INVOKER VIEW `mysql_tasks`.`schema_version` (`major`,`minor`,`patch`) AS
SELECT 3, 0, 0;
