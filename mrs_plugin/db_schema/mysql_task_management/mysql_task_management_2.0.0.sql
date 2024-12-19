/*
 * Copyright (c) 2021, 2024, Oracle and/or its affiliates.
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
-- MySQL Task Management Schema - CREATE Script

CREATE DATABASE IF NOT EXISTS `mysql_task_management` DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;

-- Set schema_version to 0.0.0 to indicate an ongoing creation/upgrade of the schema
CREATE OR REPLACE SQL SECURITY INVOKER VIEW `mysql_task_management`.`schema_version` (`major`,`minor`,`patch`) AS
SELECT 0, 0, 0;

-- -----------------------------------------------------
-- Table `mysql_task_management`.`config`
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS `mysql_task_management`.`config` (
  `id` TINYINT NOT NULL DEFAULT 1,
  `data` JSON NULL,
  PRIMARY KEY (`id`),
  CONSTRAINT Config_OnlyOneRow CHECK (id = 1))
ENGINE = InnoDB;

INSERT IGNORE INTO `mysql_task_management`.`config` (`id`, `data`)
VALUES (1, '{ "limits": { "maximumParallelTasks": 100, "maximumLakehouseLoadingTasks": 5 } }');

-- -----------------------------------------------------
-- Table `mysql_task_management`.`task_id_impl`
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS `mysql_task_management`.`task_id_impl` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `server_uuid` VARCHAR(36) NOT NULL,
  PRIMARY KEY(`id`, `server_uuid`)
) ENGINE=InnoDB AUTO_INCREMENT=1;

-- -----------------------------------------------------
-- Table `mysql_task_management`.`task_impl`
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS `mysql_task_management`.`task_impl` (
  `id` INT UNSIGNED NOT NULL,
  `server_uuid`  VARCHAR(36) NOT NULL,
  `name` VARCHAR(255) NOT NULL,
  `user` VARCHAR(288) DEFAULT (CURRENT_USER()),
  `connection_id` BIGINT UNSIGNED NOT NULL,
  `thread_id` BIGINT UNSIGNED NOT NULL,
  `task_type` VARCHAR(80),
  `data` JSON,
  PRIMARY KEY(`id`, `server_uuid`),
  INDEX(`user`),
  INDEX(`task_type`),
  CONSTRAINT `fk_task_id`
    FOREIGN KEY(`id`, `server_uuid`)
    REFERENCES `mysql_task_management`.`task_id_impl` (`id`, `server_uuid`)
) ENGINE=InnoDB;

-- -----------------------------------------------------
-- Table `mysql_task_management`.`task_log_impl`
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS `mysql_task_management`.`task_log_impl` (
  `id` BINARY(16) NOT NULL,
  `task_id` INT UNSIGNED NOT NULL,
  `server_uuid`  VARCHAR(36) NOT NULL,
  `log_time` TIMESTAMP(6) NOT NULL,
  `message` VARCHAR(2000),
  `data` JSON,
  `user` VARCHAR(288) DEFAULT (CURRENT_USER()),
  `progress` SMALLINT NOT NULL DEFAULT 0,
  `status` ENUM('SCHEDULED', 'RUNNING', 'COMPLETED', 'ERROR', 'CANCELLED') DEFAULT 'SCHEDULED',
  PRIMARY KEY(`id`),
  INDEX(`log_time`),
  INDEX(`user`),
  INDEX(`status`),
  CONSTRAINT `fk_task_log_task_id`
    FOREIGN KEY (`task_id`, `server_uuid`)
    REFERENCES `mysql_task_management`.`task_impl` (`id`, `server_uuid`)
) ENGINE=InnoDB;

-- -----------------------------------------------------
-- Trigger `mysql_task_management`.`task_impl_BEFORE_DELETE`
-- -----------------------------------------------------
DROP TRIGGER IF EXISTS `mysql_task_management`.`task_impl_BEFORE_DELETE`;
DELIMITER $$
CREATE TRIGGER `mysql_task_management`.`task_impl_BEFORE_DELETE`
BEFORE DELETE ON `mysql_task_management`.`task_impl` FOR EACH ROW
BEGIN
  DELETE FROM `mysql_task_management`.`task_log_impl`
  WHERE
    `task_id` = OLD.`id` AND
    `server_uuid` = OLD.`server_uuid`;
END$$
DELIMITER ;

-- -----------------------------------------------------
-- Trigger `mysql_task_management`.`task_impl_AFTER_DELETE`
-- -----------------------------------------------------
DROP TRIGGER IF EXISTS `mysql_task_management`.`task_impl_AFTER_DELETE`;
DELIMITER $$
CREATE TRIGGER `mysql_task_management`.`task_impl_AFTER_DELETE`
AFTER DELETE ON `mysql_task_management`.`task_impl` FOR EACH ROW
BEGIN
  DELETE FROM `mysql_task_management`.`task_id_impl`
  WHERE
    `id` = OLD.`id` AND
    `server_uuid` = OLD.`server_uuid`;
END$$
DELIMITER ;

-- -----------------------------------------------------
-- View `mysql_task_management`.`task_i`
-- note: grant only INSERT on this view to users
--       (not SELECT)
-- -----------------------------------------------------
DROP VIEW IF EXISTS `mysql_task_management`.`task_i`;
CREATE SQL SECURITY DEFINER VIEW `mysql_task_management`.`task_i` AS
  SELECT
    `task_impl`.`id` AS `id`,
    `task_impl`.`server_uuid` AS `server_uuid`,
    `task_impl`.`name` AS `name`,
    `task_impl`.`connection_id` AS `connection_id`,
    `task_impl`.`thread_id` AS `thread_id`,
    `task_impl`.`task_type` AS `task_type`,
    `task_impl`.`data` AS `data`
  FROM `mysql_task_management`.`task_impl`
  WHERE
    (LEFT(`user`, (LENGTH(`user`) - locate('@', reverse(`user`)))) =
      LEFT(user(),(length(user()) - locate('@', reverse(user())))));

-- -----------------------------------------------------
-- View `mysql_task_management`.`task_log_i`
-- note: grant only INSERT on this view to users
--       (not SELECT)
-- -----------------------------------------------------
DROP VIEW IF EXISTS `mysql_task_management`.`task_log_i`;
CREATE SQL SECURITY DEFINER VIEW `mysql_task_management`.`task_log_i` AS
SELECT
  `task_log_impl`.`id` AS `id`,
  `task_log_impl`.`server_uuid` AS `server_uuid`,
  `task_log_impl`.`task_id` AS `task_id`,
  `task_log_impl`.`log_time` AS `log_time`,
  `task_log_impl`.`message` AS `message`,
  `task_log_impl`.`data` AS `data`,
  `task_log_impl`.`progress` AS `progress`,
  `task_log_impl`.`status` AS `status`
FROM `mysql_task_management`.`task_log_impl`
WHERE
  (LEFT(`user`, (LENGTH(`user`) - LOCATE('@', REVERSE(`user`)))) =
    LEFT(user(),(length(user()) - LOCATE('@', REVERSE(user())))));

-- -----------------------------------------------------
-- View `mysql_task_management`.`task_status_impl`
--       (internal)
-- -----------------------------------------------------
DROP VIEW IF EXISTS `mysql_task_management`.`task_status_impl`;
CREATE SQL SECURITY INVOKER VIEW `mysql_task_management`.`task_status_impl` AS
SELECT
  t.id AS id,
  t.server_uuid AS server_uuid,
  t.name AS name,
  t.user AS user,
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
  `mysql_task_management`.`task_impl` t
INNER JOIN (
  SELECT
    tl1.task_id,
    tl1.server_uuid,
    MIN(tl1.log_time) AS first_log_time,
    MAX(tl1.log_time) AS last_log_time,
    COUNT(*) AS log_count
  FROM
    `mysql_task_management`.`task_log_impl` tl1
  GROUP BY
    tl1.task_id,
    tl1.server_uuid
) tl ON t.id = tl.task_id AND t.server_uuid = tl.server_uuid
LEFT OUTER JOIN `mysql_task_management`.`task_log_impl` last_tl
  ON tl.task_id = last_tl.task_id
  AND tl.server_uuid = last_tl.server_uuid
  AND tl.last_log_time = last_tl.log_time
LEFT OUTER JOIN (
  SELECT
    tl2.task_id,
    tl2.server_uuid,
    MIN(tl2.log_time) AS first_log_time
  FROM
    `mysql_task_management`.`task_log_impl` tl2
  WHERE
    status = 'RUNNING'
  GROUP BY
    tl2.task_id,
    tl2.server_uuid
) tl_running ON t.id = tl_running.task_id AND t.server_uuid = tl_running.server_uuid
JOIN (
  SELECT VARIABLE_VALUE AS server_uuid
  FROM performance_schema.global_variables
  WHERE VARIABLE_NAME = 'server_uuid'
) server_info ON 1 = 1;

-- -----------------------------------------------------
-- Function `mysql_task_management`.`task_list`
-- -----------------------------------------------------
DROP FUNCTION IF EXISTS `mysql_task_management`.`task_list`;
DELIMITER $$
CREATE FUNCTION `mysql_task_management`.`task_list`(
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
      'id', t.id,
      'server_uuid', t.server_uuid,
      'name', t.name,
      'connection_id', t.connection_id,
      'thread_id', t.thread_id,
      'task_type', t.task_type,
      'data', t.data
  )) INTO tasks
  FROM (
    SELECT t1.id, t1.server_uuid, t1.name, t1.connection_id,
           t1.thread_id, t1.task_type, t1.data
    FROM
      `mysql_task_management`.`task_impl` t1
    WHERE
      (LEFT(t1.`user`, (LENGTH(t1.`user`) - locate('@', reverse(t1.`user`)))) =
        LEFT(user(),(length(user()) - locate('@', reverse(user())))))
      AND t1.task_type LIKE `task_type`
    ORDER BY t1.id DESC
    LIMIT `limit` OFFSET `offset`
  ) t;

  RETURN tasks;
END $$
DELIMITER ;

-- -----------------------------------------------------
-- Function `mysql_task_management`.`task`
-- -----------------------------------------------------
DROP FUNCTION IF EXISTS `mysql_task_management`.`task`;
DELIMITER $$
CREATE FUNCTION `mysql_task_management`.`task`(
    task_id INT UNSIGNED,
    server_uuid VARCHAR(36)
  )
  RETURNS JSON
  READS SQL DATA
  SQL SECURITY DEFINER
BEGIN
  DECLARE tasks JSON DEFAULT NULL;

  IF server_uuid IS NULL THEN
    SELECT @@server_uuid INTO server_uuid;
  END IF;

  SELECT /*+ SET_VAR(use_secondary_engine=off) */
    JSON_OBJECT(
      'id', t.id,
      'server_uuid', t.server_uuid,
      'name', t.name,
      'connection_id', t.connection_id,
      'thread_id', t.thread_id,
      'task_type', t.task_type,
      'data', t.data,
      'logs', (
        SELECT JSON_ARRAYAGG(
          JSON_OBJECT(
            'id', BIN_TO_UUID(tl.id, 1),
            'log_time', tl.log_time,
            'message', tl.message,
            'data', tl.data,
            'progress', tl.progress,
            'status', tl.status
          )
        )
        FROM `mysql_task_management`.`task_log_impl` tl
        WHERE tl.task_id = t.id AND tl.server_uuid = t.server_uuid
        ORDER BY tl.log_time DESC
      )
  ) INTO tasks
  FROM
    `mysql_task_management`.`task_impl` t
  WHERE
    (LEFT(t.`user`, (LENGTH(t.`user`) - locate('@', reverse(t.`user`)))) =
      LEFT(user(),(length(user()) - locate('@', reverse(user())))))
    AND t.id = `task_id` AND t.server_uuid = `server_uuid`;

  RETURN tasks;
END $$
DELIMITER ;

-- -----------------------------------------------------
-- Function `mysql_task_management`.`task_logs`
-- -----------------------------------------------------
DROP FUNCTION IF EXISTS `mysql_task_management`.`task_logs`;
DELIMITER $$
CREATE FUNCTION `mysql_task_management`.`task_logs`(
    task_id INT UNSIGNED,
    server_uuid VARCHAR(36)
  )
  RETURNS JSON
  READS SQL DATA
  SQL SECURITY DEFINER
BEGIN
  DECLARE task_logs JSON DEFAULT NULL;

  IF server_uuid IS NULL THEN
    SELECT @@server_uuid INTO server_uuid;
  END IF;

  SELECT /*+ SET_VAR(use_secondary_engine=off) */ JSON_ARRAYAGG(
    JSON_OBJECT(
      'id', BIN_TO_UUID(tl.id, 1),
      'server_uuid', tl.server_uuid,
      'task_id', tl.task_id,
      'log_time', tl.log_time,
      'message', tl.message,
      'data', tl.data,
      'progress', tl.progress,
      'status', tl.status
  )) INTO task_logs
  FROM `mysql_task_management`.`task_log_impl` tl
  WHERE
    (LEFT(tl.`user`, (LENGTH(tl.`user`) - locate('@', reverse(tl.`user`)))) =
      LEFT(user(),(length(user()) - locate('@', reverse(user())))))
    AND tl.task_id = `task_id`
  ORDER BY tl.log_time DESC;

  RETURN task_logs;
END $$
DELIMITER ;

-- -----------------------------------------------------
-- Function `mysql_task_management`.`task_status_list`
-- -----------------------------------------------------
DROP FUNCTION IF EXISTS `mysql_task_management`.`task_status_list`;
DELIMITER $$
CREATE FUNCTION `mysql_task_management`.`task_status_list`(
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
        'server_uuid', sq.server_uuid,
        'name', sq.name,
        'task_type', sq.task_type,
        'data', sq.data,
        'log_data', sq.log_data,
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
        `mysql_task_management`.`task_status_impl` tsi
      WHERE
        LEFT(tsi.user, LENGTH(tsi.user) - LOCATE('@', REVERSE(tsi.user))) =
        LEFT(SESSION_USER(), LENGTH(SESSION_USER()) - LOCATE('@', REVERSE(SESSION_USER())))
        AND tsi.task_type LIKE `task_type`
      ORDER BY tsi.id DESC
      LIMIT `limit` OFFSET `offset`
    ) sq
  );
END $$
DELIMITER ;

-- -----------------------------------------------------
-- Function `mysql_task_management`.`task_status`
-- -----------------------------------------------------
DROP FUNCTION IF EXISTS `mysql_task_management`.`task_status`;
DELIMITER $$
CREATE FUNCTION `mysql_task_management`.`task_status`(
    task_id INT UNSIGNED,
    server_uuid VARCHAR(36)
  )
  RETURNS JSON
  READS SQL DATA
  SQL SECURITY DEFINER
BEGIN

  IF server_uuid IS NULL THEN
    SELECT @@server_uuid INTO server_uuid;
  END IF;

  RETURN (
    SELECT /*+ SET_VAR(use_secondary_engine=off) */
      JSON_OBJECT(
        'id', sq.id,
        'server_uuid', sq.server_uuid,
        'name', sq.name,
        'task_type', sq.task_type,
        'data', sq.data,
        'log_data', sq.log_data,
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
        `mysql_task_management`.`task_status_impl` tsi
      WHERE
        LEFT(tsi.user, LENGTH(tsi.user) - LOCATE('@', REVERSE(tsi.user))) =
        LEFT(SESSION_USER(), LENGTH(SESSION_USER()) - LOCATE('@', REVERSE(SESSION_USER())))
        AND tsi.id = `task_id` AND tsi.server_uuid = `server_uuid`
      LIMIT 1
    ) sq
  );
END $$
DELIMITER ;

-- -----------------------------------------------------
-- Function `mysql_task_management`.`active_task_count`
-- -----------------------------------------------------
DROP FUNCTION IF EXISTS `mysql_task_management`.`active_task_count`;
DELIMITER $$
CREATE FUNCTION `mysql_task_management`.`active_task_count`()
  RETURNS INT UNSIGNED
  READS SQL DATA
  SQL SECURITY DEFINER
BEGIN
  RETURN (
    SELECT COUNT(active_task.task_id) FROM (
      SELECT
        DISTINCT(tl.task_id) AS task_id
      FROM
        `mysql_task_management`.`task_log_impl` tl
      JOIN
        `mysql_task_management`.`task_impl` t
      ON
        tl.task_id = t.id AND
        tl.server_uuid = t.server_uuid
      WHERE
        tl.status IN ('RUNNING', 'SCHEDULED')
      AND tl.task_id NOT IN (
        SELECT DISTINCT(tli.task_id)
        FROM
          `mysql_task_management`.`task_log_impl` tli
        WHERE
          tli.status IN ('COMPLETED', 'ERROR', 'CANCELLED')
      )
    ) active_task
  );
END $$
DELIMITER ;

-- -----------------------------------------------------
-- Procedure `mysql_task_management`.`create_task_id`
-- -----------------------------------------------------
DROP PROCEDURE IF EXISTS `mysql_task_management`.`create_task_id`;
DELIMITER $$
CREATE PROCEDURE `mysql_task_management`.`create_task_id`(OUT `task_id` INT UNSIGNED)
SQL SECURITY DEFINER
BEGIN
  DECLARE done INT DEFAULT FALSE;
  DECLARE next_free_id INT UNSIGNED;

  -- Loop until the insert succeeds
  WHILE NOT done DO
    -- Find the next available ID
    WITH RECURSIVE seq AS (
      SELECT 1 AS id
      UNION ALL
      SELECT id + 1
      FROM seq
      WHERE id < (SELECT COALESCE(MAX(id), 0) + 1 FROM mysql_task_management.task_id_impl)
    )
    SELECT
      /*+ SET_VAR(use_secondary_engine=off) */
      MIN(seq.id) INTO next_free_id
    FROM seq
    LEFT JOIN mysql_task_management.task_id_impl id_impl ON seq.id = id_impl.id
    WHERE id_impl.id IS NULL;

    -- Try to insert the ID; if successful, exit the loop
    BEGIN
      DECLARE EXIT HANDLER FOR SQLEXCEPTION
      BEGIN
        -- If there's a duplicate key error, retry by continuing the loop
        SET done = FALSE;
      END;

      -- Attempt to insert; set `done` to true if successful
      INSERT INTO mysql_task_management.task_id_impl (id, server_uuid) VALUES (next_free_id, @@server_uuid);
      SET done = TRUE;
    END;

    -- Set the OUT parameter to the inserted ID
    SET `task_id` = next_free_id;
  END WHILE;
END $$
DELIMITER ;

-- -----------------------------------------------------
-- Procedure `mysql_task_management`.`create_task`
-- -----------------------------------------------------
DROP PROCEDURE IF EXISTS `mysql_task_management`.`create_task`;
DELIMITER $$
CREATE PROCEDURE `mysql_task_management`.`create_task`(
	IN `name` VARCHAR(255), IN `task_type` VARCHAR(45), IN `data` JSON, OUT `task_id` INT UNSIGNED)
SQL SECURITY INVOKER
BEGIN
  CALL `mysql_task_management`.`create_task_id`(task_id);
  CALL `mysql_task_management`.`create_task_with_id`(task_id, `name`, task_type, `data`);
END$$
DELIMITER ;

-- -----------------------------------------------------
-- Procedure `mysql_task_management`.`create_task_with_id`
-- -----------------------------------------------------
DROP PROCEDURE IF EXISTS `mysql_task_management`.`create_task_with_id`;
DELIMITER $$
CREATE PROCEDURE `mysql_task_management`.`create_task_with_id`(
    IN `id` INT UNSIGNED, IN `name` VARCHAR(255), IN `task_type` VARCHAR(45), IN `data` JSON)
    SQL SECURITY INVOKER
BEGIN
  INSERT INTO `mysql_task_management`.`task_i`(`id`, `server_uuid`, `name`, `connection_id`, `thread_id`, `task_type`, `data`)
    VALUES (id, @@server_uuid, `name`, CONNECTION_ID(), PS_CURRENT_THREAD_ID(), task_type, `data`);

  CALL `mysql_task_management`.`add_task_log`(id, 'Task created by user.', NULL, 0, 'SCHEDULED');
END$$
DELIMITER ;

-- -----------------------------------------------------
-- Procedure `mysql_task_management`.`add_task_log`
-- -----------------------------------------------------
DROP PROCEDURE IF EXISTS `mysql_task_management`.`add_task_log`;
DELIMITER $$
CREATE PROCEDURE `mysql_task_management`.`add_task_log`(
    IN `task_id` INT UNSIGNED, IN `message` VARCHAR(2000), IN `data` JSON, IN `progress` SMALLINT,
    IN `status` ENUM('SCHEDULED', 'RUNNING', 'COMPLETED', 'ERROR', 'CANCELLED'))
    SQL SECURITY INVOKER
BEGIN
  SET @__log_id = UUID_TO_BIN(UUID(), 1);

  INSERT INTO `mysql_task_management`.`task_log_i` (`id`, `server_uuid`, `task_id`, `log_time`, `message`, `data`, `progress`, `status`)
    VALUES (@__log_id, @@server_uuid, task_id, NOW(6), message, `data`, progress, `status`);
END$$
DELIMITER ;

-- -----------------------------------------------------
-- Procedure `mysql_task_management`.`kill_task`
-- -----------------------------------------------------
DROP PROCEDURE IF EXISTS `mysql_task_management`.`kill_task`;
DELIMITER $$
CREATE PROCEDURE `mysql_task_management`.`kill_task`(IN `id` INT UNSIGNED)
    SQL SECURITY INVOKER
BEGIN
  DECLARE task_status JSON DEFAULT NULL;

  DECLARE status TEXT DEFAULT NULL;
  DECLARE suuid VARCHAR(36) DEFAULT NULL;
  DECLARE cid BIGINT UNSIGNED DEFAULT NULL;
  DECLARE i INT DEFAULT 0;
  DECLARE event_name TEXT DEFAULT NULL;

  SELECT `mysql_task_management`.`task_status`(id) INTO task_status;

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
      CALL `mysql_task_management`.`drop_event`(event_name);
      SELECT i+1 INTO i;
    END WHILE;
  END IF;

  CALL `mysql_task_management`.`add_task_log`(id, 'Cancelled by user.', NULL, 100, 'CANCELLED');

END$$
DELIMITER ;

-- -----------------------------------------------------
-- Procedure `mysql_task_management`.`drop_event`
-- -----------------------------------------------------
DROP PROCEDURE IF EXISTS `mysql_task_management`.`drop_event`;
DELIMITER $$
CREATE PROCEDURE `mysql_task_management`.`drop_event`(IN `event_name` TEXT)
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
    `mysql_task_management`.`schema_version` v;

  -- get comment from the runner event
  SELECT
    /*+ SET_VAR(use_secondary_engine=off) */
    EVENT_COMMENT INTO event_cmnt
  FROM
    information_schema.events e
  WHERE
    CONCAT(sys.quote_identifier(e.EVENT_SCHEMA), '.', sys.quote_identifier(e.EVENT_NAME)) = `event_name`
    AND e.EVENT_COMMENT LIKE 'mysql_task_management_version=%';

  SET version_string = SUBSTRING_INDEX(event_cmnt, 'mysql_task_management_version=', -1); -- Get the part after "="
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
-- Procedure `mysql_task_management`.`execute_prepared_stmt_async`
-- -----------------------------------------------------
DROP PROCEDURE IF EXISTS `mysql_task_management`.`execute_prepared_stmt_async`;
DELIMITER $$
CREATE PROCEDURE `mysql_task_management`.`execute_prepared_stmt_async`(
  IN `name` VARCHAR(45), IN `sql_statements` TEXT, IN `schema_name` VARCHAR(255), OUT task_id INT UNSIGNED)
  SQL SECURITY INVOKER
BEGIN
  DECLARE event_name TEXT DEFAULT NULL;
  DECLARE task_mgmt_version TEXT DEFAULT NULL;
  DECLARE max_parallel_tasks INT UNSIGNED DEFAULT NULL;

  DECLARE EXIT HANDLER FOR SQLEXCEPTION
  BEGIN
      GET DIAGNOSTICS CONDITION 1 @p1 = RETURNED_SQLSTATE, @p2 = MYSQL_ERRNO, @p3 = MESSAGE_TEXT;
      SELECT RELEASE_LOCK('execute_prepared_stmt_async') INTO @__tmp;
      SET @__tmp = NULL;
      IF @p3 = 'No schema set.' THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'No schema set. Please pass in the schema name or set the current schema with USE.',
            MYSQL_ERRNO = 5400;
      ELSE
        RESIGNAL;
      END IF;
  END;

  SELECT JSON_EXTRACT(data, '$.limits.maximumParallelTasks') INTO max_parallel_tasks
  FROM
    `mysql_task_management`.`config`
  WHERE id = 1
  LIMIT 1;

  IF schema_name IS NULL THEN
    SELECT current_schema INTO schema_name
      /*+ SET_VAR(use_secondary_engine=off) */
      FROM `performance_schema`.`events_statements_current`
      WHERE thread_id=PS_CURRENT_THREAD_ID()
          AND nesting_event_level=0;
  END IF;
  IF schema_name IS NULL THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'No schema set.', MYSQL_ERRNO = 5400;
  END IF;

  IF NOT REGEXP_LIKE(sql_statements, ';[:space:]*$') THEN
    SET sql_statements = CONCAT(sql_statements, '; ');
  END IF;

  SELECT /*+ SET_VAR(use_secondary_engine=off) */ CONCAT(sys.quote_identifier(schema_name), '.', sys.quote_identifier(UUID())) INTO event_name;
  SELECT /*+ SET_VAR(use_secondary_engine=off) */ CONCAT(major, '.', minor, '.', patch) FROM `mysql_task_management`.`schema_version` INTO task_mgmt_version;

  SELECT GET_LOCK('execute_prepared_stmt_async', 2) INTO @__tmp;

  IF `mysql_task_management`.`active_task_count`() >= max_parallel_tasks THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Maximum number of parallel tasks reached, try again later.', MYSQL_ERRNO = 5400;
  END IF;

  CALL `mysql_task_management`.`create_task_id`(task_id);

  SET @eventSql = CONCAT(
    'CREATE EVENT ', event_name, ' ',
    'ON SCHEDULE AT NOW() ON COMPLETION NOT PRESERVE ENABLE ',
    'COMMENT "mysql_task_management_version=', task_mgmt_version, '" ',
    'DO BEGIN ',
    'DECLARE EXIT HANDLER FOR SQLEXCEPTION BEGIN ',
    '  GET DIAGNOSTICS CONDITION 1 @p1 = RETURNED_SQLSTATE, @p2 = MYSQL_ERRNO, @p3 = MESSAGE_TEXT; ',
    '  CALL `mysql_task_management`.`add_task_log`(', task_id, ', "error", json_object("error", @p3), 100, "ERROR"); ',
    'END; ',
    'SET @task_id =', task_id, '; SET @task_result = NULL; ',
    'CALL `mysql_task_management`.`create_task_with_id`(@task_id, "', name, '", "Async_SQL", JSON_OBJECT("events", JSON_ARRAY("', event_name, '"), "auto_gc", true)); ',
    'CALL `mysql_task_management`.`add_task_log`(@task_id, "Event execution started...", NULL, 0, "RUNNING"); ',
    sql_statements,
    'CALL `mysql_task_management`.`add_task_log`(@task_id, "Execution finished.", @task_result, 100, "COMPLETED"); ',
    'END;');

  PREPARE dynamic_statement FROM @eventSql;
  EXECUTE dynamic_statement;
  DEALLOCATE PREPARE dynamic_statement;

  SELECT RELEASE_LOCK('execute_prepared_stmt_async') INTO @__tmp;
  SET @__tmp = NULL;
END$$
DELIMITER ;

-- -----------------------------------------------------
-- EVENT `mysql_task_management`.`task_cleanup`
-- -----------------------------------------------------
DROP EVENT IF EXISTS `mysql_task_management`.`task_cleanup`;
DELIMITER $$
CREATE EVENT `mysql_task_management`.`task_cleanup` ON SCHEDULE EVERY 1 DAY
ON COMPLETION NOT PRESERVE ENABLE COMMENT 'Clean up old tasks' DO
BEGIN
  DECLARE task_ids_to_del JSON DEFAULT NULL;

  -- find all old tasks
  SELECT /*+ SET_VAR(use_secondary_engine=off) */ JSON_ARRAYAGG(
    JSON_OBJECT(
      'task_id', last_tl.task_id,
      'server_uuid', last_tl.server_uuid
    )
  ) into @task_ids_to_del
  FROM (
    SELECT
      task_id,
      server_uuid,
      MAX(log_time) AS last_log_time
    FROM
      `mysql_task_management`.`task_log_impl`
    GROUP BY
      task_id, server_uuid
  ) tl
  LEFT OUTER JOIN
    `mysql_task_management`.`task_log_impl`  last_tl
    ON tl.task_id = last_tl.task_id AND tl.server_uuid = last_tl.server_uuid AND tl.last_log_time = last_tl.log_time
  WHERE (last_tl.status <> 'SCHEDULED' AND last_tl.status <> 'RUNNING')
    AND last_tl.log_time < DATE_SUB(NOW(6), INTERVAL 2 WEEK);

  -- delete all old tasks
  DELETE FROM
    `mysql_task_management`.`task_impl`
  WHERE (id, server_uuid) IN (
    SELECT * FROM JSON_TABLE(
      @task_ids_to_del,
      '$[*]' COLUMNS (
        task_id INT PATH '$.task_id',
        server_uuid VARCHAR(36) PATH '$.server_uuid'
      )
    ) AS jt
  );

END$$
DELIMITER ;

-- -----------------------------------------------------
-- EVENT `mysql_task_management`.`task_gc`
-- -----------------------------------------------------
DROP EVENT IF EXISTS `mysql_task_management`.`task_gc`;
DELIMITER $$
CREATE EVENT `mysql_task_management`.`task_gc` ON SCHEDULE EVERY 1 MINUTE
ON COMPLETION NOT PRESERVE ENABLE COMMENT 'Garbage collector' DO
BEGIN
  DECLARE i, j INT DEFAULT 0;
  DECLARE json_id JSON DEFAULT NULL;
  DECLARE json_user JSON DEFAULT NULL;
  DECLARE json_data JSON DEFAULT NULL;
  DECLARE curr_id INT UNSIGNED DEFAULT NULL;
  DECLARE curr_user TEXT DEFAULT NULL;
  DECLARE curr_data JSON DEFAULT NULL;
  DECLARE event_name TEXT DEFAULT NULL;

  -- Find active tasks without alive process
  SELECT /*+ SET_VAR(use_secondary_engine=off) */
  JSON_ARRAYAGG(t.id), JSON_ARRAYAGG(t.user), JSON_ARRAYAGG(t.data) INTO json_id, json_user, json_data
  FROM `mysql_task_management`.`task_log_impl` tl
  JOIN (
    SELECT task_id, server_uuid, MAX(log_time) AS max_log_time, MAX(id) AS max_id
    FROM `mysql_task_management`.`task_log_impl`
    GROUP BY task_id, server_uuid
  ) tl2
  ON tl.log_time = tl2.max_log_time AND tl.server_uuid = tl2.server_uuid
  JOIN `mysql_task_management`.`task_impl` t
  ON tl.task_id = t.id AND tl.server_uuid = t.server_uuid
  LEFT JOIN `performance_schema`.`processlist` p ON t.connection_id = p.id
  WHERE
    (tl.status = 'RUNNING' OR tl.status = 'SCHEDULED')
    AND p.id IS NULL
    AND t.server_uuid = @@server_uuid
    AND t.data->'$.auto_gc' = true;

  WHILE i < JSON_LENGTH(json_id) DO
    SET curr_id = JSON_EXTRACT(json_id, CONCAT('$[', i, ']'));
    SET curr_user = JSON_UNQUOTE(JSON_EXTRACT(json_user, CONCAT('$[', i, ']')));
    SET curr_data = JSON_EXTRACT(json_data, CONCAT('$[', i, ']'));

    IF curr_data IS NOT NULL AND JSON_CONTAINS_PATH(curr_data, 'one', '$.events')  THEN
      SET j = 0;
      WHILE j < JSON_LENGTH(JSON_EXTRACT(curr_data, '$.events')) DO
        SET event_name = JSON_UNQUOTE(JSON_EXTRACT(curr_data, CONCAT('$.events[', j, ']')));
        CALL `mysql_task_management`.`drop_event`(event_name);
        SET j = j + 1;
      END WHILE;
    END IF;

    IF curr_id IS NOT NULL THEN
      INSERT INTO `mysql_task_management`.`task_log_impl` (`id`, `user`, `task_id`, `server_uuid`, `log_time`, `message`, `data`, `progress`, `status`)
        VALUES (UUID_TO_BIN(UUID(), 1), curr_user, curr_id, @@server_uuid, NOW(6), 'Cleaned up by the system', NULL, 100, 'CANCELLED');
    END IF;

    SELECT i + 1 INTO i;
  END WHILE;

  -- Find dangling events from tasks which are no longer running
  SELECT /*+ SET_VAR(use_secondary_engine=off) */
  JSON_ARRAYAGG(t.id), JSON_ARRAYAGG(t.user), JSON_ARRAYAGG(t.data) INTO json_id, json_user, json_data
  FROM `mysql_task_management`.`task_log_impl` tl
  JOIN (
    SELECT task_id, server_uuid, MAX(log_time) AS max_log_time, MAX(id) AS max_id
    FROM `mysql_task_management`.`task_log_impl`
    GROUP BY task_id, server_uuid
  ) tl2
  ON tl.log_time = tl2.max_log_time AND tl.server_uuid = tl2.server_uuid
  JOIN `mysql_task_management`.`task_impl` t
  ON tl.task_id = t.id AND tl.server_uuid = t.server_uuid
  JOIN information_schema.events ise
    ON JSON_UNQUOTE(t.data->'$.events[0]') =  CONCAT(sys.quote_identifier(ise.EVENT_SCHEMA), '.', sys.quote_identifier(ise.EVENT_NAME))
  LEFT JOIN `performance_schema`.`processlist` p ON t.connection_id = p.id
  WHERE
    (tl.status <> 'RUNNING' AND tl.status <> 'SCHEDULED')
    AND p.id IS NULL
    AND t.server_uuid = @@server_uuid
    AND t.data->'$.auto_gc' = true;

  WHILE i < JSON_LENGTH(json_id) DO
    SET curr_id = JSON_EXTRACT(json_id, CONCAT('$[', i, ']'));
    SET curr_user = JSON_UNQUOTE(JSON_EXTRACT(json_user, CONCAT('$[', i, ']')));
    SET curr_data = JSON_EXTRACT(json_data, CONCAT('$[', i, ']'));

    IF curr_data IS NOT NULL AND JSON_CONTAINS_PATH(curr_data, 'one', '$.events')  THEN
      SET j = 0;
      WHILE j < JSON_LENGTH(JSON_EXTRACT(curr_data, '$.events')) DO
        SET event_name = JSON_UNQUOTE(JSON_EXTRACT(curr_data, CONCAT('$.events[', j, ']')));
        CALL `mysql_task_management`.`drop_event`(event_name);
        SET j = j + 1;
      END WHILE;
    END IF;

    SELECT i + 1 INTO i;
  END WHILE;
END$$
DELIMITER ;

-- -----------------------------------------------------
-- Set the schema_version VIEW to the correct version at the very end
CREATE OR REPLACE SQL SECURITY INVOKER VIEW `mysql_task_management`.`schema_version` (`major`,`minor`,`patch`) AS
SELECT 2, 0, 0;
