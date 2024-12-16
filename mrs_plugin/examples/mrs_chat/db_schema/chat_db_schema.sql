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

CREATE SCHEMA IF NOT EXISTS `chat`;

DELIMITER %%
DROP PROCEDURE IF EXISTS `chat`.`execute_prepared_stmt_async`%%
CREATE DEFINER=`dba`@`%` PROCEDURE `chat`.`execute_prepared_stmt_async`(
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
END%%

DROP PROCEDURE IF EXISTS `chat`.`heatwave_chat_async`%%
CREATE DEFINER=`dba`@`%` PROCEDURE `chat`.`heatwave_chat_async`(
    IN `prompt` TEXT, IN `options` JSON, OUT task_id INT UNSIGNED)
    SQL SECURITY INVOKER
BEGIN
    DECLARE hw_chat_schema TEXT;
    SELECT IF(COUNT(*) > 0, 'sys', 'chat') INTO hw_chat_schema
    FROM information_schema.ROUTINES WHERE ROUTINE_TYPE = 'PROCEDURE'
        AND ROUTINE_SCHEMA = 'sys' AND ROUTINE_NAME = 'heatwave_chat';

    CALL `chat`.`execute_prepared_stmt_async`('HeatWave Chat', CONCAT(
            'SET @chat_options = ', quote(options), '; '
            'CALL ', sys.quote_identifier(hw_chat_schema), '.heatwave_chat(', quote(prompt), '); ',
            'SET @task_result = @chat_options'
        ), 'chat', task_id);
END%%

DROP PROCEDURE IF EXISTS `chat`.`heatwave_chat_async_result`%%
CREATE DEFINER=`dba`@`%` PROCEDURE `chat`.`heatwave_chat_async_result`(
    IN task_id INT UNSIGNED, OUT `status` VARCHAR(20), OUT progress INT UNSIGNED, OUT `response` TEXT, OUT `chat_options` JSON)
    SQL SECURITY INVOKER
BEGIN
    SELECT tl.status, tl.progress, tl.data->>'$.response', tl.data
    INTO status, progress, response, chat_options
    FROM mysql_task_management.task_log tl
    WHERE tl.task_id = task_id
    ORDER BY log_time DESC
    LIMIT 1;
END%%

DROP PROCEDURE IF EXISTS `chat`.`heatwave_chat`%%
CREATE DEFINER=`dba`@`%` PROCEDURE `chat`.`heatwave_chat`(in prompt text)
BEGIN
    SET @chat_options=JSON_OBJECT('response', concat('Very good question, "', prompt, '", indeed!'));
END%%

DELIMITER ;

