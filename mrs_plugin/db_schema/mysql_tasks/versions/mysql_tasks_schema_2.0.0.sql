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
-- MySQL Tasks Schema - CREATE Script

DROP SCHEMA IF EXISTS `mysql_tasks`;
CREATE SCHEMA `mysql_tasks` DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;

-- Set schema_version to 0.0.0 to indicate an ongoing creation/upgrade of the schema
CREATE OR REPLACE SQL SECURITY INVOKER VIEW `mysql_tasks`.`schema_version` (`major`,`minor`,`patch`) AS
SELECT 0, 0, 0;

-- -----------------------------------------------------
-- Table `mysql_tasks`.`config`
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS `mysql_tasks`.`config` (
  `id` TINYINT NOT NULL DEFAULT 1,
  `data` JSON NULL,
  PRIMARY KEY (`id`),
  CONSTRAINT Config_OnlyOneRow CHECK (id = 1))
ENGINE = InnoDB;

-- cSpell:ignore Lakehouse
INSERT IGNORE INTO `mysql_tasks`.`config` (`id`, `data`)
VALUES (1, '{ "limits": { "maximumPreparedStmtAsyncTasks": 100, "maximumLakehouseLoadingTasks": 5 } }');

-- -----------------------------------------------------
-- Table `mysql_tasks`.`task_impl`
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS `mysql_tasks`.`task_impl` (
  `id` BINARY(16) NOT NULL COMMENT 'A UUID uniquely identifying the task across replication instances in binary format. The id should be created by the function call UUID_TO_BIN(UUID(), 1) which generates the BINARY representation of the UUID in reverse order to improve indexing. The field is usually hidden from end users.',
  `mysql_user` VARCHAR(288) DEFAULT (CURRENT_USER()) COMMENT 'The MySQL user that created the task.',
  `app_user_id` BINARY(16) COMMENT 'An optional UUID representing a specific application user. If set, the app_user_id will be used to filter tasks per application users, preventing an app user to see tasks from other app users.',
  `alias` VARCHAR(16) COMMENT 'A human readable alias that allows easier referencing of a specific task. It uses the format {Abbreviated weekday name}-{task count per mysql_user or user_id if specified}, e.g. Mon-1, Mon-2, Tue-1, etc. Please note that there is no guarantee that the alias will be unique, while still being useful in the majority of cases as old task are deleted after 7 days.',
  `name` VARCHAR(255) NOT NULL COMMENT 'The name of the task.',
  `server_uuid`  BINARY(16) NOT NULL COMMENT 'The UUID of the server on which the task has been created. It should be populated using UUID_TO_BIN(@@server_uuid, 1).',
  `connection_id` BIGINT UNSIGNED NOT NULL COMMENT 'The MySQL server connection_id that was used to created the task.',
  `task_type` VARCHAR(80) NOT NULL COMMENT 'An application defined task type, used for filtering of tasks per type.',
  `data` JSON COMMENT 'Can hold application specific data.',
  `data_json_schema` JSON COMMENT 'A JSON schema defining the structure of the data field for the given task.',
  `log_data_json_schema` JSON COMMENT 'A JSON schema defining the structure of the task_log_impl.data field for the given task.',
  PRIMARY KEY(`id`),
  INDEX(`mysql_user`),
  INDEX(`mysql_user`, `alias`),
  INDEX(`task_type`)
) ENGINE=InnoDB;

-- -----------------------------------------------------
-- Table `mysql_tasks`.`task_log_impl`
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS `mysql_tasks`.`task_log_impl` (
  `id` BINARY(16) NOT NULL COMMENT 'A UUID uniquely identifying a task log entry. It should be created by the function call UUID_TO_BIN(UUID(), 1) which generates the BINARY representation of the UUID in the reverse order to improve indexing.',
  `task_id` BINARY(16) NOT NULL COMMENT 'The task ID (foreign key).',
  `mysql_user` VARCHAR(288) DEFAULT (CURRENT_USER()) COMMENT 'The MySQL user that created the task / inserted the task log.',
  `log_time` TIMESTAMP(6) NOT NULL COMMENT 'A timestamp when the task log entry was inserted.',
  `message` VARCHAR(2000) COMMENT 'A task log message.',
  `data` JSON COMMENT 'Can hold application specific log data. It must conform to log_data_json_schema defined in the`task_impl` table.',
  `progress` SMALLINT NOT NULL DEFAULT 0 COMMENT 'A task completion progress between 0 and 100%.',
  `status` ENUM('SCHEDULED', 'RUNNING', 'COMPLETED', 'ERROR', 'CANCELLED') DEFAULT 'SCHEDULED' COMMENT 'The task state. When created, a task goes in the SCHEDULED state, then is moved to RUNNING and finally COMPLETED state. In case of ERROR, the task status becomes ERROR. When task is killed by the user or by the garbage collector, it gets the CANCELLED status.',
  PRIMARY KEY(`id`),
  INDEX(`mysql_user`),
  INDEX(`log_time`),
  INDEX(`status`),
  CONSTRAINT `fk_task_log_task_id`
    FOREIGN KEY (`task_id`)
    REFERENCES `mysql_tasks`.`task_impl` (`id`)
) ENGINE=InnoDB;

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
  SELECT
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
-- Trigger `mysql_tasks`.`task_impl_BEFORE_DELETE`
-- -----------------------------------------------------
DROP TRIGGER IF EXISTS `mysql_tasks`.`task_impl_BEFORE_DELETE`;
DELIMITER $$
CREATE TRIGGER `mysql_tasks`.`task_impl_BEFORE_DELETE`
BEFORE DELETE ON `mysql_tasks`.`task_impl` FOR EACH ROW
BEGIN
  DELETE FROM `mysql_tasks`.`task_log_impl`
  WHERE
    `task_id` = OLD.`id`;
END$$
DELIMITER ;

-- -----------------------------------------------------
-- View `mysql_tasks`.`task_i`
-- note: grant only INSERT on this view to users
--       (not SELECT)
-- -----------------------------------------------------
DROP VIEW IF EXISTS `mysql_tasks`.`task_i`;
CREATE SQL SECURITY DEFINER VIEW `mysql_tasks`.`task_i` AS
  SELECT
    `task_impl`.`id` AS `id`,
    `task_impl`.`app_user_id` AS `app_user_id`,
    `task_impl`.`alias` AS `alias`,
    `task_impl`.`name` AS `name`,
    `task_impl`.`server_uuid` AS `server_uuid`,
    `task_impl`.`connection_id` AS `connection_id`,
    `task_impl`.`task_type` AS `task_type`,
    `task_impl`.`data` AS `data`,
    `task_impl`.`data_json_schema` AS `data_json_schema`,
    `task_impl`.`log_data_json_schema` AS `log_data_json_schema`
  FROM `mysql_tasks`.`task_impl`
  WHERE
    (LEFT(`mysql_user`, (LENGTH(`mysql_user`) - locate('@', reverse(`mysql_user`)))) =
      LEFT(user(),(length(user()) - locate('@', reverse(user())))));

-- -----------------------------------------------------
-- View `mysql_tasks`.`task_log_i`
-- note: grant only INSERT on this view to users
--       (not SELECT)
-- -----------------------------------------------------
DROP VIEW IF EXISTS `mysql_tasks`.`task_log_i`;
CREATE SQL SECURITY DEFINER VIEW `mysql_tasks`.`task_log_i` AS
SELECT
  `task_log_impl`.`id` AS `id`,
  `task_log_impl`.`task_id` AS `task_id`,
  `task_log_impl`.`log_time` AS `log_time`,
  `task_log_impl`.`message` AS `message`,
  `task_log_impl`.`data` AS `data`,
  `task_log_impl`.`progress` AS `progress`,
  `task_log_impl`.`status` AS `status`
FROM `mysql_tasks`.`task_log_impl`
WHERE
  (LEFT(`mysql_user`, (LENGTH(`mysql_user`) - LOCATE('@', REVERSE(`mysql_user`)))) =
    LEFT(user(),(length(user()) - LOCATE('@', REVERSE(user())))));

-- -----------------------------------------------------
-- View `mysql_tasks`.`task_status_impl`
--   for internal use
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
    last_tl.progress,
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
      last_tl.progress = 0,
      NULL,
      CAST(
        TIMESTAMPADD(
          SECOND,
          ROUND(
            TIMESTAMPDIFF(
              SECOND,
              tl_running.first_log_time,
              tl.last_log_time
            ) / last_tl.progress * 100
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
      last_tl.progress = 0,
      NULL,
      TIMESTAMPDIFF(
        SECOND,
        tl_running.first_log_time,
        tl.last_log_time
      ) / last_tl.progress * 100.0 - TIMESTAMPDIFF(
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
      REPEAT('#', FLOOR(last_tl.progress / 10)),
      REPEAT('_', 10 - FLOOR(last_tl.progress / 10))
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
    COUNT(*) AS log_count
  FROM
    `mysql_tasks`.`task_log_impl` tl1
  GROUP BY
    tl1.task_id
) tl ON t.id = tl.task_id
LEFT OUTER JOIN `mysql_tasks`.`task_log_impl` last_tl
  ON tl.task_id = last_tl.task_id
  AND tl.last_log_time = last_tl.log_time
LEFT OUTER JOIN (
  SELECT
    tl2.task_id,
    MIN(tl2.log_time) AS first_log_time
  FROM
    `mysql_tasks`.`task_log_impl` tl2
  WHERE
    status = 'RUNNING'
  GROUP BY
    tl2.task_id
) tl_running ON t.id = tl_running.task_id
JOIN (
  SELECT UUID_TO_BIN(VARIABLE_VALUE, 1) AS server_uuid
  FROM performance_schema.global_variables
  WHERE VARIABLE_NAME = 'server_uuid'
) server_info ON 1 = 1;

-- -----------------------------------------------------
-- Function `mysql_tasks`.`app_task_list`
-- -----------------------------------------------------
DROP FUNCTION IF EXISTS `mysql_tasks`.`app_task_list`;
DELIMITER $$
CREATE FUNCTION `mysql_tasks`.`app_task_list`(
  `app_user_id` VARCHAR(36),
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
      AND (`app_user_id` IS NULL OR t1.app_user_id = UUID_TO_BIN(`app_user_id`, 1))
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
    SELECT `mysql_tasks`.`app_task_list`(NULL, `task_type`, `offset`, `limit`)
  );
END $$
DELIMITER ;

-- -----------------------------------------------------
-- Function `mysql_tasks`.`app_task`
-- -----------------------------------------------------
DROP FUNCTION IF EXISTS `mysql_tasks`.`app_task`;
DELIMITER $$
CREATE FUNCTION `mysql_tasks`.`app_task`(
    app_user_id VARCHAR(36),
    id_or_alias VARCHAR(36)
  )
  RETURNS JSON
  READS SQL DATA
  SQL SECURITY DEFINER
BEGIN
  DECLARE tasks JSON DEFAULT NULL;
  DECLARE task_id VARCHAR(36);

  SELECT `mysql_tasks`.`get_task_id`(id_or_alias) INTO task_id;

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
    AND (`app_user_id` IS NULL OR t.app_user_id = UUID_TO_BIN(`app_user_id`, 1))
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
    app_user_id VARCHAR(36),
    id_or_alias VARCHAR(36),
    newer_than_log_time TIMESTAMP(6)
  )
  RETURNS JSON
  READS SQL DATA
  SQL SECURITY DEFINER
BEGIN
  DECLARE task_logs JSON DEFAULT NULL;
  DECLARE task_id VARCHAR(36);

  SELECT `mysql_tasks`.`get_task_id`(id_or_alias) INTO task_id;

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
    AND (`app_user_id` IS NULL OR t.app_user_id = UUID_TO_BIN(`app_user_id`, 1))
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
    SELECT `mysql_tasks`.`app_task_logs`(NULL, id_or_alias, newer_than_log_time)
  );
END $$
DELIMITER ;

-- -----------------------------------------------------
-- Function `mysql_tasks`.`app_task_status_list`
-- -----------------------------------------------------
DROP FUNCTION IF EXISTS `mysql_tasks`.`app_task_status_list`;
DELIMITER $$
CREATE FUNCTION `mysql_tasks`.`app_task_status_list`(
    `app_user_id` VARCHAR(36),
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
        AND (`app_user_id` IS NULL OR tsi.app_user_id = UUID_TO_BIN(`app_user_id`, 1))
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
    SELECT `mysql_tasks`.`app_task_status_list`(NULL, `task_type`, `offset`, `limit`)
  );
END $$
DELIMITER ;

-- -----------------------------------------------------
-- Function `mysql_tasks`.`app_task_status`
-- -----------------------------------------------------
DROP FUNCTION IF EXISTS `mysql_tasks`.`app_task_status`;
DELIMITER $$
CREATE FUNCTION `mysql_tasks`.`app_task_status`(
    app_user_id VARCHAR(36),
    id_or_alias VARCHAR(36)
  )
  RETURNS JSON
  READS SQL DATA
  SQL SECURITY DEFINER
BEGIN
  DECLARE task_id VARCHAR(36);

  SELECT `mysql_tasks`.`get_task_id`(id_or_alias) INTO task_id;

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
        AND (`app_user_id` IS NULL OR tsi.app_user_id = UUID_TO_BIN(`app_user_id`, 1))
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
    SELECT `mysql_tasks`.`app_task_status`(NULL, id_or_alias)
  );
END $$
DELIMITER ;

-- -----------------------------------------------------
-- Function `mysql_tasks`.`app_task_status_brief`
-- -----------------------------------------------------
DROP FUNCTION IF EXISTS `mysql_tasks`.`app_task_status_brief`;
DELIMITER $$
CREATE FUNCTION `mysql_tasks`.`app_task_status_brief`(
    app_user_id VARCHAR(36),
    id_or_alias VARCHAR(36)
  )
  RETURNS JSON
  READS SQL DATA
  SQL SECURITY DEFINER
BEGIN

  DECLARE task_id VARCHAR(36);

  SELECT `mysql_tasks`.`get_task_id`(id_or_alias) INTO task_id;

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
        AND (`app_user_id` IS NULL OR tsi.app_user_id = UUID_TO_BIN(`app_user_id`, 1))
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
    SELECT `mysql_tasks`.`app_task_status_brief`(NULL, id_or_alias)
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
    SELECT
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
    SELECT
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
    SELECT COUNT(active_task.task_id) FROM (
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
    app_user_id VARCHAR(36),
    alias VARCHAR(16)
  )
  RETURNS JSON
  READS SQL DATA
  SQL SECURITY DEFINER
BEGIN
  RETURN (
    SELECT JSON_ARRAYAGG(
      BIN_TO_UUID(t.id, 1)
    )
    FROM
      `mysql_tasks`.`task_impl` t
    WHERE
      LEFT(t.mysql_user, LENGTH(t.mysql_user) - LOCATE('@', REVERSE(t.mysql_user))) =
      LEFT(SESSION_USER(), LENGTH(SESSION_USER()) - LOCATE('@', REVERSE(SESSION_USER())))
      AND (`app_user_id` IS NULL OR t.app_user_id = UUID_TO_BIN(`app_user_id`, 1))
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
    SELECT `mysql_tasks`.`get_app_task_ids_from_alias`(NULL, alias)
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
    app_user_id VARCHAR(36),
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
    SELECT `mysql_tasks`.`get_app_task_ids_from_alias`(app_user_id, id_or_alias) INTO task_ids;

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
    SELECT `mysql_tasks`.`get_app_task_id`(NULL, id_or_alias)
  );
END $$
DELIMITER ;

-- -----------------------------------------------------
-- Function `mysql_tasks`.`get_app_task_alias`
-- -----------------------------------------------------
DROP FUNCTION IF EXISTS `mysql_tasks`.`get_app_task_alias`;
DELIMITER $$
CREATE FUNCTION `mysql_tasks`.`get_app_task_alias`(
    app_user_id VARCHAR(36),
    id VARCHAR(36)
  )
  RETURNS VARCHAR(16)
  READS SQL DATA
  SQL SECURITY INVOKER
BEGIN
  DECLARE task_info JSON;
  SELECT `mysql_tasks`.`app_task`(app_user_id, id) INTO task_info;
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
    SELECT `mysql_tasks`.`get_app_task_alias`(NULL, id)
  );
END $$
DELIMITER ;

-- -----------------------------------------------------
-- Procedure `mysql_tasks`.`create_app_task`
-- -----------------------------------------------------
DROP PROCEDURE IF EXISTS `mysql_tasks`.`create_app_task`;
DELIMITER $$
CREATE PROCEDURE `mysql_tasks`.`create_app_task`(
  IN `app_user_id` VARCHAR(36),
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
  IN `app_user_id` VARCHAR(36),
  IN `id` VARCHAR(36), IN `name` VARCHAR(255), IN `task_type` VARCHAR(45), IN `data` JSON,
  IN `data_json_schema` JSON, IN `log_data_json_schema` JSON)
SQL SECURITY INVOKER
BEGIN
  -- insert entry into task table
  INSERT INTO `mysql_tasks`.`task_i`(`id`, `app_user_id`, `server_uuid`, `name`, `connection_id`, `task_type`, `data`, `data_json_schema`, `log_data_json_schema`)
    VALUES (UUID_TO_BIN(id, 1), UUID_TO_BIN(app_user_id, 1), UUID_TO_BIN(@@server_uuid, 1), `name`, CONNECTION_ID(), task_type, `data`, `data_json_schema`, `log_data_json_schema`);

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

  SELECT `mysql_tasks`.`get_task_log_data_json_schema`(task_id) INTO log_data_json_schema;

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
CREATE PROCEDURE `mysql_tasks`.`kill_app_task`(IN `app_user_id` VARCHAR(36), IN `id_or_alias` VARCHAR(36))
    SQL SECURITY INVOKER
BEGIN
  DECLARE task_id VARCHAR(36);
  DECLARE task_status JSON DEFAULT NULL;

  DECLARE status TEXT DEFAULT NULL;
  DECLARE suuid VARCHAR(36) DEFAULT NULL;
  DECLARE cid BIGINT UNSIGNED DEFAULT NULL;
  DECLARE i INT DEFAULT 0;
  DECLARE event_name TEXT DEFAULT NULL;

  SELECT `mysql_tasks`.`get_app_task_id`(app_user_id, id_or_alias) INTO task_id;

  SELECT `mysql_tasks`.`app_task_status`(app_user_id, task_id) INTO task_status;

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
  IF JSON_CONTAINS_PATH(task_status, 'one', '$.data.events') THEN
    WHILE i < JSON_LENGTH(task_status->'$.data.events') DO
      SET event_name = JSON_UNQUOTE(JSON_EXTRACT(task_status->'$.data.events', CONCAT('$[',i,']')));
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
  IN `app_user_id` VARCHAR(36),
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
  SELECT `mysql_tasks`.`active_task_count`() INTO active_task_cnt;
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
-- Procedure `mysql_tasks`.`stop_task_monitor`
-- -----------------------------------------------------
DROP PROCEDURE IF EXISTS `mysql_tasks`.`stop_task_monitor`;
DELIMITER $$
CREATE PROCEDURE `mysql_tasks`.`stop_task_monitor`(
  IN `event_name` TEXT
)
SQL SECURITY INVOKER
BEGIN

  SET @eventSql = CONCAT(
    'DROP EVENT IF EXISTS ', event_name
  );

  PREPARE dynamic_statement FROM @eventSql;
  EXECUTE dynamic_statement;
  DEALLOCATE PREPARE dynamic_statement;

END$$
DELIMITER ;

-- -----------------------------------------------------
-- EVENT `mysql_tasks`.`task_cleanup`
-- -----------------------------------------------------
DROP EVENT IF EXISTS `mysql_tasks`.`task_cleanup`;
DELIMITER $$
CREATE EVENT `mysql_tasks`.`task_cleanup` ON SCHEDULE EVERY 1 DAY
ON COMPLETION NOT PRESERVE ENABLE COMMENT 'Clean up old tasks' DO
BEGIN
  DECLARE task_ids_to_del JSON DEFAULT NULL;

  -- find all tasks with last tog time
  -- more than 6 days old from the current date
  SELECT /*+ SET_VAR(use_secondary_engine=off) */ JSON_ARRAYAGG(
    BIN_TO_UUID(last_tl.task_id, 1)
  ) INTO @task_ids_to_del
  FROM (
    SELECT
      task_id,
      MAX(log_time) AS last_log_time
    FROM
      `mysql_tasks`.`task_log_impl`
    GROUP BY
      task_id
  ) tl
  LEFT OUTER JOIN
    `mysql_tasks`.`task_log_impl`  last_tl
    ON tl.task_id = last_tl.task_id AND tl.last_log_time = last_tl.log_time
  WHERE (last_tl.status <> 'SCHEDULED' AND last_tl.status <> 'RUNNING')
    AND last_tl.log_time < DATE_SUB(CURDATE(), INTERVAL 6 DAY);

  -- delete all old tasks
  DELETE FROM
    `mysql_tasks`.`task_impl`
  WHERE BIN_TO_UUID(id, 1) MEMBER OF(@task_ids_to_del);

END$$
DELIMITER ;

-- -----------------------------------------------------
-- EVENT `mysql_tasks`.`task_gc`
-- -----------------------------------------------------
DROP EVENT IF EXISTS `mysql_tasks`.`task_gc`;
DELIMITER $$
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

  -- Find active tasks without alive process
  SELECT /*+ SET_VAR(use_secondary_engine=off) */
  JSON_ARRAYAGG(BIN_TO_UUID(t.id, 1)), JSON_ARRAYAGG(t.mysql_user), JSON_ARRAYAGG(t.data) INTO json_id, json_user, json_data
  FROM `mysql_tasks`.`task_log_impl` tl
  JOIN (
    SELECT task_id, MAX(log_time) AS max_log_time, MAX(id) AS max_id
    FROM `mysql_tasks`.`task_log_impl`
    GROUP BY task_id
  ) tl2
  ON tl.log_time = tl2.max_log_time
  JOIN `mysql_tasks`.`task_impl` t
  ON tl.task_id = t.id
  LEFT JOIN `performance_schema`.`processlist` p ON t.connection_id = p.id
  WHERE
    (tl.status = 'RUNNING' OR tl.status = 'SCHEDULED')
    AND p.id IS NULL
    AND t.server_uuid = UUID_TO_BIN(@@server_uuid, 1)
    AND t.data->'$.autoGc' = true;

  WHILE i < JSON_LENGTH(json_id) DO
    SET curr_id = JSON_UNQUOTE(JSON_EXTRACT(json_id, CONCAT('$[', i, ']')));
    SET curr_user = JSON_UNQUOTE(JSON_EXTRACT(json_user, CONCAT('$[', i, ']')));
    SET curr_data = JSON_EXTRACT(json_data, CONCAT('$[', i, ']'));

    IF curr_data IS NOT NULL AND JSON_CONTAINS_PATH(curr_data, 'one', '$.events')  THEN
      SET j = 0;
      WHILE j < JSON_LENGTH(JSON_EXTRACT(curr_data, '$.events')) DO
        SET event_name = JSON_UNQUOTE(JSON_EXTRACT(curr_data, CONCAT('$.events[', j, ']')));
        CALL `mysql_tasks`.`drop_event`(event_name);
        SET j = j + 1;
      END WHILE;
    END IF;

    IF curr_id IS NOT NULL THEN
      INSERT INTO `mysql_tasks`.`task_log_impl` (`id`, `mysql_user`, `task_id`, `log_time`, `message`, `data`, `progress`, `status`)
        VALUES (UUID_TO_BIN(UUID(), 1), curr_user, UUID_TO_BIN(curr_id, 1), NOW(6), 'Cleaned up by system.', NULL, 100, 'CANCELLED');
    END IF;

    SELECT i + 1 INTO i;
  END WHILE;

  -- Find dangling events from tasks which are no longer running
  SELECT /*+ SET_VAR(use_secondary_engine=off) */
  JSON_ARRAYAGG(BIN_TO_UUID(t.id, 1)), JSON_ARRAYAGG(t.data) INTO json_id, json_data
  FROM `mysql_tasks`.`task_log_impl` tl
  JOIN (
    SELECT task_id, MAX(log_time) AS max_log_time, MAX(id) AS max_id
    FROM `mysql_tasks`.`task_log_impl`
    GROUP BY task_id
  ) tl2
  ON tl.log_time = tl2.max_log_time
  JOIN `mysql_tasks`.`task_impl` t
  ON tl.task_id = t.id
  JOIN information_schema.events ise
    ON JSON_UNQUOTE(t.data->'$.events[0]') =  CONCAT(mysql_tasks.quote_identifier(ise.EVENT_SCHEMA), '.', mysql_tasks.quote_identifier(ise.EVENT_NAME))
  LEFT JOIN `performance_schema`.`processlist` p ON t.connection_id = p.id
  WHERE
    (tl.status <> 'RUNNING' AND tl.status <> 'SCHEDULED')
    AND p.id IS NULL
    AND t.server_uuid = UUID_TO_BIN(@@server_uuid, 1)
    AND t.data->'$.autoGc' = true;

  WHILE i < JSON_LENGTH(json_id) DO
    SET curr_data = JSON_EXTRACT(json_data, CONCAT('$[', i, ']'));

    IF curr_data IS NOT NULL AND JSON_CONTAINS_PATH(curr_data, 'one', '$.events')  THEN
      SET j = 0;
      WHILE j < JSON_LENGTH(JSON_EXTRACT(curr_data, '$.events')) DO
        SET event_name = JSON_UNQUOTE(JSON_EXTRACT(curr_data, CONCAT('$.events[', j, ']')));
        CALL `mysql_tasks`.`drop_event`(event_name);
        SET j = j + 1;
      END WHILE;
    END IF;

    SELECT i + 1 INTO i;
  END WHILE;
END$$
DELIMITER ;


-- -----------------------------------------------------
-- FUNCTION `mysql_tasks`.`quote_identifier`
-- (copy of sys.quote_identifier to avoid permission issues)
-- -----------------------------------------------------
DROP FUNCTION IF EXISTS `mysql_tasks`.`quote_identifier`;
DELIMITER $$
CREATE FUNCTION `mysql_tasks`.`quote_identifier`(in_identifier TEXT)
    RETURNS TEXT CHARSET UTF8MB4
    SQL SECURITY INVOKER
    DETERMINISTIC
    NO SQL
BEGIN
    RETURN CONCAT('`', REPLACE(in_identifier, '`', '``'), '`');
END$$
DELIMITER ;


-- -----------------------------------------------------
-- Create roles for the MySQL Tasks

-- The mysql_task_admin ROLE allows to fully manage the MySQL tasks schema
-- The mysql_task_user ROLE allows to create and work with MySQL tasks

CREATE ROLE IF NOT EXISTS 'mysql_task_admin', 'mysql_task_user';

-- GRANTS for mysql_task_admin
GRANT ALL ON `mysql_tasks`.* TO 'mysql_task_admin';

-- GRANTS for mysql_task_user
GRANT SELECT ON `mysql_tasks`.`config` TO 'mysql_task_user';
GRANT SELECT ON `mysql_tasks`.`schema_version` TO 'mysql_task_user';
GRANT INSERT ON `mysql_tasks`.`task_i` TO 'mysql_task_user';
GRANT INSERT ON `mysql_tasks`.`task_log_i` TO 'mysql_task_user';
GRANT EXECUTE ON FUNCTION `mysql_tasks`.`task_list` TO 'mysql_task_user';
GRANT EXECUTE ON FUNCTION `mysql_tasks`.`task` TO 'mysql_task_user';
GRANT EXECUTE ON FUNCTION `mysql_tasks`.`task_logs` TO 'mysql_task_user';
GRANT EXECUTE ON FUNCTION `mysql_tasks`.`task_status_list` TO 'mysql_task_user';
GRANT EXECUTE ON FUNCTION `mysql_tasks`.`task_status` TO 'mysql_task_user';
GRANT EXECUTE ON FUNCTION `mysql_tasks`.`task_status_brief` TO 'mysql_task_user';
GRANT EXECUTE ON FUNCTION `mysql_tasks`.`active_task_count` TO 'mysql_task_user';
GRANT EXECUTE ON FUNCTION `mysql_tasks`.`find_task_log_msg` TO 'mysql_task_user';
GRANT EXECUTE ON FUNCTION `mysql_tasks`.`get_task_ids_from_alias` TO 'mysql_task_user';
GRANT EXECUTE ON FUNCTION `mysql_tasks`.`get_task_id` TO 'mysql_task_user';
GRANT EXECUTE ON FUNCTION `mysql_tasks`.`get_task_alias` TO 'mysql_task_user';
GRANT EXECUTE ON FUNCTION `mysql_tasks`.`get_task_log_data_json_schema` TO 'mysql_task_user';
GRANT EXECUTE ON FUNCTION `mysql_tasks`.`get_task_connection_id` TO 'mysql_task_user';
GRANT EXECUTE ON PROCEDURE `mysql_tasks`.`create_task` TO 'mysql_task_user';
GRANT EXECUTE ON PROCEDURE `mysql_tasks`.`create_task_with_id` TO 'mysql_task_user';
GRANT EXECUTE ON PROCEDURE `mysql_tasks`.`add_task_log` TO 'mysql_task_user';
GRANT EXECUTE ON PROCEDURE `mysql_tasks`.`kill_task` TO 'mysql_task_user';
GRANT EXECUTE ON PROCEDURE `mysql_tasks`.`drop_event` TO 'mysql_task_user';
GRANT EXECUTE ON FUNCTION `mysql_tasks`.`app_task_list` TO 'mysql_task_user';
GRANT EXECUTE ON FUNCTION `mysql_tasks`.`app_task` TO 'mysql_task_user';
GRANT EXECUTE ON FUNCTION `mysql_tasks`.`app_task_logs` TO 'mysql_task_user';
GRANT EXECUTE ON FUNCTION `mysql_tasks`.`app_task_status_list` TO 'mysql_task_user';
GRANT EXECUTE ON FUNCTION `mysql_tasks`.`app_task_status` TO 'mysql_task_user';
GRANT EXECUTE ON FUNCTION `mysql_tasks`.`app_task_status_brief` TO 'mysql_task_user';
GRANT EXECUTE ON FUNCTION `mysql_tasks`.`get_app_task_ids_from_alias` TO 'mysql_task_user';
GRANT EXECUTE ON FUNCTION `mysql_tasks`.`get_app_task_id` TO 'mysql_task_user';
GRANT EXECUTE ON FUNCTION `mysql_tasks`.`get_app_task_alias` TO 'mysql_task_user';
GRANT EXECUTE ON PROCEDURE `mysql_tasks`.`create_app_task` TO 'mysql_task_user';
GRANT EXECUTE ON PROCEDURE `mysql_tasks`.`create_app_task_with_id` TO 'mysql_task_user';
GRANT EXECUTE ON PROCEDURE `mysql_tasks`.`kill_app_task` TO 'mysql_task_user';
GRANT EXECUTE ON PROCEDURE `mysql_tasks`.`execute_prepared_stmt_from_app_async` TO 'mysql_task_user';
GRANT EXECUTE ON PROCEDURE `mysql_tasks`.`execute_prepared_stmt_async` TO 'mysql_task_user';
GRANT EXECUTE ON PROCEDURE `mysql_tasks`.`start_task_monitor` TO 'mysql_task_user';
GRANT EXECUTE ON PROCEDURE `mysql_tasks`.`stop_task_monitor` TO 'mysql_task_user';

GRANT EXECUTE ON FUNCTION `mysql_tasks`.`quote_identifier` TO 'mysql_task_user';
GRANT SELECT ON `performance_schema`.`events_statements_current` TO 'mysql_task_user';

-- -----------------------------------------------------
-- Set the schema_version VIEW to the correct version at the very end
CREATE OR REPLACE SQL SECURITY INVOKER VIEW `mysql_tasks`.`schema_version` (`major`,`minor`,`patch`) AS
SELECT 2, 0, 0;

