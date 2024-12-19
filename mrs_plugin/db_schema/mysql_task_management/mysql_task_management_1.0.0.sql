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
USE `mysql_task_management`;

-- Set schema_version to 0.0.0 to indicate an ongoing creation/upgrade of the schema
CREATE OR REPLACE SQL SECURITY INVOKER VIEW `mysql_task_management`.`schema_version` (`major`,`minor`,`patch`) AS
SELECT 0, 0, 0;

-- -----------------------------------------------------
-- Table `mysql_task_management`.`task_id_impl`
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS `task_id_impl` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=1;

-- -----------------------------------------------------
-- Table `mysql_task_management`.`task_impl`
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS `task_impl` (
  `id` int unsigned NOT NULL,
  `name` VARCHAR(255) NOT NULL,
  `user` VARCHAR(288) DEFAULT (current_user()),
  `connection_id` bigint unsigned NOT NULL,
  `thread_id` bigint unsigned NOT NULL,
  `task_type` VARCHAR(80) DEFAULT NULL,
  `data` json DEFAULT NULL,
  PRIMARY KEY (`id`),
  INDEX(`name`),
  INDEX(`user`),
  INDEX(`task_type`),
  CONSTRAINT `fk_task_impl_task_id_impl_idx` FOREIGN KEY (`id`)
    REFERENCES `task_id_impl` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB;

-- -----------------------------------------------------
-- Table `mysql_task_management`.`task_log_impl`
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS `task_log_impl` (
  `id` binary(16) NOT NULL,
  `task_id` int unsigned NOT NULL,
  `log_time` timestamp(6) NOT NULL,
  `message` VARCHAR(2000) DEFAULT NULL,
  `data` json DEFAULT NULL,
  `user` VARCHAR(288) DEFAULT (current_user()),
  `progress` smallint NOT NULL DEFAULT '0',
  `status` enum('SCHEDULED','RUNNING','COMPLETED','ERROR','CANCELLED') DEFAULT 'SCHEDULED',
  PRIMARY KEY (`id`),
  INDEX(`log_time`),
  INDEX(`user`),
  INDEX(`status`),
  INDEX `fk_task_log_impl_task_impl_idx` (`task_id` ASC),
  CONSTRAINT `fk_task_log_task` FOREIGN KEY (`task_id`) REFERENCES `task_impl` (`id`) ON DELETE RESTRICT
) ENGINE=InnoDB;

-- -----------------------------------------------------
-- View `mysql_task_management`.`task`
-- -----------------------------------------------------
DROP VIEW IF EXISTS `mysql_task_management`.`task`;
CREATE SQL SECURITY DEFINER VIEW `mysql_task_management`.`task` AS
  SELECT `mysql_task_management`.`task_impl`.`id` AS `id`,
    `mysql_task_management`.`task_impl`.`name` AS `name`,
    `mysql_task_management`.`task_impl`.`connection_id` AS `connection_id`,
    `mysql_task_management`.`task_impl`.`thread_id` AS `thread_id`,
    `mysql_task_management`.`task_impl`.`task_type` AS `task_type`,
    `mysql_task_management`.`task_impl`.`data` AS `data`
  FROM `mysql_task_management`.`task_impl`
  WHERE
    (LEFT(`user`, (LENGTH(`user`) - locate('@', reverse(`user`)))) =
      LEFT(user(),(length(user()) - locate('@', reverse(user())))));

-- -----------------------------------------------------
-- View `mysql_task_management`.`task_log`
-- -----------------------------------------------------
DROP VIEW IF EXISTS `mysql_task_management`.`task_log`;
CREATE DEFINER = CURRENT_USER SQL SECURITY DEFINER VIEW `mysql_task_management`.`task_log` AS
SELECT `mysql_task_management`.`task_log_impl`.`id` AS `id`,
  `mysql_task_management`.`task_log_impl`.`task_id` AS `task_id`,
  `mysql_task_management`.`task_log_impl`.`log_time` AS `log_time`,
  `mysql_task_management`.`task_log_impl`.`message` AS `message`,
  `mysql_task_management`.`task_log_impl`.`data` AS `data`,
  `mysql_task_management`.`task_log_impl`.`progress` AS `progress`,
  `mysql_task_management`.`task_log_impl`.`status` AS `status`
FROM `mysql_task_management`.`task_log_impl`
WHERE
  (LEFT(`user`, (LENGTH(`user`) - LOCATE('@', REVERSE(`user`)))) =
    LEFT(user(),(length(user()) - LOCATE('@', REVERSE(user())))));


-- -----------------------------------------------------
-- View `mysql_task_management`.`task_status`
-- -----------------------------------------------------
DROP VIEW IF EXISTS `mysql_task_management`.`task_status`;
CREATE SQL SECURITY INVOKER VIEW `mysql_task_management`.`task_status` AS
SELECT
  t.id,
  t.name,
  t.task_type,
  t.connection_id,
  t.data,
  last_tl.data AS log_data,
  last_tl.message,
  last_tl.progress,
  last_tl.status,
  CAST(tl.first_log_time AS DATETIME) AS scheduled_time,
  CAST(tl_running.first_log_time AS DATETIME) AS starting_time,
  CAST(tl.last_log_time AS DATETIME) AS log_time,
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
  ) AS estimated_completion_time,
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
  ) AS estimated_remaining_time,
  CONCAT(
    REPEAT('#', FLOOR(last_tl.progress / 10)),
    REPEAT('_', 10 - FLOOR(last_tl.progress / 10))
  ) AS progress_bar
FROM
  `mysql_task_management`.`task` t
  INNER JOIN (
    SELECT
      task_id,
      MIN(log_time) AS first_log_time,
      MAX(log_time) AS last_log_time,
      COUNT(*) AS log_count
    FROM
      `mysql_task_management`.`task_log`
    GROUP BY
      task_id
  ) tl ON t.id = tl.task_id
  LEFT OUTER JOIN `mysql_task_management`.`task_log` last_tl ON tl.task_id = last_tl.task_id
  AND tl.last_log_time = last_tl.log_time
  LEFT OUTER JOIN (
    SELECT
      task_id,
      MIN(log_time) AS first_log_time
    FROM
      `mysql_task_management`.`task_log`
    WHERE
      status = 'RUNNING'
    GROUP BY
      task_id
  ) tl_running ON t.id = tl_running.task_id;


DELIMITER $$

-- -----------------------------------------------------
-- Trigger `mysql_task_management`.`task_impl_BEFORE_DELETE`
-- -----------------------------------------------------
DROP TRIGGER IF EXISTS `task_impl_BEFORE_DELETE`$$
CREATE DEFINER = CURRENT_USER TRIGGER `task_impl_BEFORE_DELETE`
BEFORE DELETE ON `mysql_task_management`.`task_impl` FOR EACH ROW
BEGIN
  DELETE FROM `mysql_task_management`.`task_log_impl` WHERE `task_id` = OLD.`id`;
END$$

-- -----------------------------------------------------
-- Procedure `mysql_task_management`.`create_task_id`
-- -----------------------------------------------------
DROP PROCEDURE IF EXISTS `create_task_id`$$
CREATE DEFINER = CURRENT_USER PROCEDURE `create_task_id`(OUT `id` INT UNSIGNED)
BEGIN
  INSERT INTO `mysql_task_management`.`task_id_impl` VALUES (NULL);
  SET id = LAST_INSERT_ID();
END $$

-- -----------------------------------------------------
-- Procedure `mysql_task_management`.`create_task`
-- -----------------------------------------------------
DROP PROCEDURE IF EXISTS `create_task`$$
CREATE DEFINER = CURRENT_USER PROCEDURE `create_task`(
    IN `name` VARCHAR(255), IN `task_type` VARCHAR(45), IN `data` JSON)
    SQL SECURITY INVOKER
BEGIN
  DECLARE task_id INT UNSIGNED DEFAULT NULL;

  CALL `mysql_task_management`.`create_task_id`(task_id);
  CALL `mysql_task_management`.`create_task_with_id`(task_id, `name`, task_type, `data`);

  SELECT task_id;
END$$

-- -----------------------------------------------------
-- Procedure `mysql_task_management`.`create_task_with_id`
-- -----------------------------------------------------
DROP PROCEDURE IF EXISTS `create_task_with_id`$$
CREATE DEFINER = CURRENT_USER PROCEDURE `create_task_with_id`(
    IN `id` INT UNSIGNED, IN `name` VARCHAR(255), IN `task_type` VARCHAR(45), IN `data` JSON)
    SQL SECURITY INVOKER
BEGIN
  INSERT INTO `mysql_task_management`.`task`(`id`, `name`, `connection_id`, `thread_id`, `task_type`, `data`)
  VALUES (id, `name`, CONNECTION_ID(), PS_CURRENT_THREAD_ID(), task_type, `data`);

  CALL `mysql_task_management`.`add_task_log`(id, 'Task created by user.', NULL, 0, 'SCHEDULED');
END$$

-- -----------------------------------------------------
-- Procedure `mysql_task_management`.`add_task_log`
-- -----------------------------------------------------
DROP PROCEDURE IF EXISTS `add_task_log`$$
CREATE DEFINER = CURRENT_USER PROCEDURE `add_task_log`(
    IN `task_id` INT UNSIGNED, IN `message` VARCHAR(2000), IN `data` JSON, IN `progress` SMALLINT,
    IN `status` ENUM('SCHEDULED', 'RUNNING', 'COMPLETED', 'ERROR', 'CANCELLED'))
    SQL SECURITY INVOKER
BEGIN
  SET @__log_id = UUID_TO_BIN(UUID(), 1);

  INSERT INTO `mysql_task_management`.`task_log` (`id`, `task_id`, `log_time`, `message`, `data`, `progress`, `status`)
    VALUES (@__log_id, task_id, NOW(6), message, `data`, progress, `status`);
END$$

-- -----------------------------------------------------
-- Procedure `mysql_task_management`.`kill_task`
-- -----------------------------------------------------
DROP PROCEDURE IF EXISTS `kill_task`$$
CREATE DEFINER = CURRENT_USER PROCEDURE `kill_task`(IN `id` INT UNSIGNED)
    SQL SECURITY INVOKER
BEGIN
  DECLARE tid INT UNSIGNED DEFAULT NULL;
  DECLARE progress SMALLINT DEFAULT NULL;

  SELECT t.id, COALESCE(t.progress, 0) INTO tid, progress
  FROM `mysql_task_management`.`task_status` t
  WHERE t.id = id;

  IF tid IS NOT NULL THEN
    SELECT mysql_task_management_kill_task(id) INTO @__tmp;
    CALL `mysql_task_management`.`add_task_log`(id, 'Cancelled by user.', NULL, progress, 'CANCELLED');
  ELSE
    SIGNAL SQLSTATE '45000'
    SET MESSAGE_TEXT = 'Task does not exist or not allowed to access it.';
  END IF;
END$$

-- -----------------------------------------------------
-- Procedure `mysql_task_management`.`execute_prepared_stmt_async`
-- -----------------------------------------------------
DROP PROCEDURE IF EXISTS `execute_prepared_stmt_async`$$
CREATE DEFINER=`dba`@`%` PROCEDURE `execute_prepared_stmt_async`(
    IN `name` VARCHAR(45), IN `sql_statements` TEXT, IN `schema_name` VARCHAR(255), OUT task_id INT UNSIGNED)
    SQL SECURITY INVOKER
BEGIN
    DECLARE EXIT HANDLER FOR SQLEXCEPTION
    BEGIN
        GET DIAGNOSTICS CONDITION 1 @p1 = RETURNED_SQLSTATE, @p2 = MYSQL_ERRNO, @p3 = MESSAGE_TEXT;
        IF @p3 = 'No schema set.' THEN
            SIGNAL SQLSTATE '45000'
                SET MESSAGE_TEXT = 'No schema set. Please pass in the schema name or set the current schema with USE.',
                MYSQL_ERRNO = 5400;
        ELSE
            CALL `mysql_task_management`.`add_task_log`(task_id, 'error', json_object('error', @p3), 100, 'ERROR');
        END IF;
    END;

    CALL `mysql_task_management`.`create_task_id`(task_id);
    CALL `mysql_task_management`.`create_task_with_id`(task_id, name, 'Async_SQL', NULL);

    IF schema_name IS NULL THEN
        SELECT current_schema INTO schema_name
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

    SET @eventSql = CONCAT(
        'CREATE EVENT ', sys.quote_identifier(schema_name), '.`', UUID(), '` ',
        'ON SCHEDULE AT NOW() ON COMPLETION NOT PRESERVE ENABLE DO BEGIN ',
        'DECLARE EXIT HANDLER FOR SQLEXCEPTION BEGIN ',
        '  GET DIAGNOSTICS CONDITION 1 @p1 = RETURNED_SQLSTATE, @p2 = MYSQL_ERRNO, @p3 = MESSAGE_TEXT; ',
        '  CALL `mysql_task_management`.`add_task_log`(', task_id, ', "error", json_object("error", @p3), 100, "ERROR"); ',
        'END; ',
        'SET @task_id =', task_id, '; SET @task_result = NULL; ',
        'CALL `mysql_task_management`.`add_task_log`(@task_id, "Event execution started...", NULL, 0, "RUNNING"); ',
        sql_statements,
        'CALL `mysql_task_management`.`add_task_log`(@task_id, "Execution finished.", @task_result, 100, "COMPLETED"); ',
        'END;');

    CALL `mysql_task_management`.`add_task_log`(
        task_id, 'Scheduling event...',
        json_object('sql', @eventSql, 'role', cast(current_role() as char), 'user', CURRENT_USER()), 0, 'RUNNING');
    PREPARE dynamic_statement FROM @eventSql;
    EXECUTE dynamic_statement;
    DEALLOCATE PREPARE dynamic_statement;
END$$

-- -----------------------------------------------------
-- EVENT `mysql_task_management`.`task_cleanup`
-- -----------------------------------------------------
DROP EVENT IF EXISTS `task_cleanup`$$
CREATE EVENT `task_cleanup` ON SCHEDULE EVERY 1 DAY STARTS '2024-01-01 00:00:00'
ON COMPLETION NOT PRESERVE ENABLE COMMENT 'Clean up old tasks' DO
BEGIN
    DELETE FROM mysql_task_management.task_impl
    WHERE id IN (
      SELECT last_tl.task_id
      FROM (
          SELECT task_id, MAX(log_time) AS last_log_time
          FROM mysql_task_management.task_log_impl
          GROUP BY task_id) tl
          LEFT OUTER JOIN mysql_task_management.task_log_impl last_tl
              ON tl.task_id = last_tl.task_id AND tl.last_log_time = last_tl.log_time
      WHERE (last_tl.status <> 'SCHEDULED' AND last_tl.status <> 'RUNNING')
          AND last_tl.log_time < DATE_SUB(NOW(6), INTERVAL 1 MONTH));
END$$

-- -----------------------------------------------------
-- EVENT `mysql_task_management`.`task_gc`
-- -----------------------------------------------------
DROP EVENT IF EXISTS `task_gc`$$
CREATE EVENT `task_gc` ON SCHEDULE EVERY 1 MINUTE STARTS '2024-01-01 00:00:00'
ON COMPLETION NOT PRESERVE ENABLE DO
BEGIN
    DECLARE i INT DEFAULT 0;
    DECLARE json_id JSON DEFAULT NULL;
    DECLARE json_user JSON DEFAULT NULL;
    DECLARE json_data JSON DEFAULT NULL;
    DECLARE curr_id INT UNSIGNED DEFAULT NULL;
    DECLARE curr_user TEXT DEFAULT NULL;
    DECLARE curr_data JSON DEFAULT NULL;

    SELECT JSON_ARRAYAGG(t.id), JSON_ARRAYAGG(t.user), JSON_ARRAYAGG(t.data)
    INTO json_id, json_user, json_data
    FROM `mysql_task_management`.`task_log_impl` tl
        JOIN (
            SELECT task_id, MAX(log_time) AS max_log_time, MAX(id) AS max_id
            FROM `mysql_task_management`.`task_log_impl`
            GROUP BY task_id ) tl2
            ON tl.log_time = tl2.max_log_time
        JOIN `mysql_task_management`.`task_impl` t
            ON tl.task_id = t.id
        LEFT JOIN `performance_schema`.`processlist` p
            ON t.connection_id = p.id
    WHERE (tl.status = 'RUNNING' OR tl.status = 'SCHEDULED') AND p.id IS NULL;

    WHILE i < JSON_LENGTH(json_id) DO
        SET curr_id = JSON_EXTRACT(json_id, CONCAT('$[', i, ']'));
        SET curr_user = JSON_UNQUOTE(JSON_EXTRACT(json_user, CONCAT('$[', i, ']')));
        SET curr_data = JSON_EXTRACT(json_data, CONCAT('$[', i, ']'));

        IF curr_data IS NOT NULL AND JSON_CONTAINS_PATH(curr_data, 'one', '$.events') THEN
            SELECT mysql_task_management_kill_events(JSON_EXTRACT(curr_data, '$.events')) INTO @tmp;
        END IF;

        IF curr_id IS NOT NULL THEN
            SET @__log_id = UUID_TO_BIN(UUID(), 1);
            INSERT INTO `mysql_task_management`.`task_log_impl`(
                `id`, `task_id`, `user`, `log_time`, `message`, `progress`, `status`)
            VALUES (@__log_id, curr_id, curr_user, NOW(6), 'Cleaned up by the system', 0, 'CANCELLED');
        END IF;

        SELECT i + 1 INTO i;
    END WHILE;
END$$

DELIMITER ;

-- -----------------------------------------------------
-- Set the schema_version VIEW to the correct version at the very end

CREATE OR REPLACE SQL SECURITY INVOKER VIEW `mysql_task_management`.`schema_version` (`major`,`minor`,`patch`) AS
SELECT 1, 0, 0;
