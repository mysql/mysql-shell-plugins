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
DROP PROCEDURE IF EXISTS `chat`.`async_sql_execute`%%
CREATE DEFINER=`dba`@`%` PROCEDURE `chat`.`async_sql_execute`(
    IN `name` VARCHAR(45), IN `schema_name` VARCHAR(255), IN `sql_stmts` TEXT, OUT task_id INT UNSIGNED)
    SQL SECURITY INVOKER
BEGIN
    DECLARE EXIT HANDLER FOR SQLEXCEPTION
    BEGIN
    GET DIAGNOSTICS CONDITION 1 @p1 = RETURNED_SQLSTATE, @p2 = MYSQL_ERRNO, @p3 = MESSAGE_TEXT;
    CALL `mysql_task_management`.`add_task_log`(task_id, 'error', json_object('error', @p3), 100, 'ERROR');
    END;

    CALL `mysql_task_management`.`create_task_id`(task_id);
    CALL `mysql_task_management`.`create_task_with_id`(task_id, name, 'Async_SQL', NULL);

    SET @eventSql = CONCAT(
        'CREATE EVENT ', sys.quote_identifier(schema_name), '.`', UUID(), '` ',
        'ON SCHEDULE AT NOW() ON COMPLETION NOT PRESERVE ENABLE DO BEGIN ',
        'SET @task_id =', task_id, ';',
        sql_stmts,
        ' END');

    CALL `mysql_task_management`.`add_task_log`(task_id, 'Scheduling event...', json_object('sql', @eventSql, 'role', cast(current_role() as char), 'user', CURRENT_USER()), 0, 'RUNNING');
    PREPARE dynamic_statement FROM @eventSql;
    EXECUTE dynamic_statement;
    DEALLOCATE PREPARE dynamic_statement;
END%%

DROP PROCEDURE IF EXISTS `chat`.`do_async_chat`%%
CREATE PROCEDURE `chat`.`do_async_chat`(IN `prompt` TEXT, IN `options` JSON)
    SQL SECURITY INVOKER
BEGIN
    DECLARE EXIT HANDLER FOR SQLEXCEPTION
    BEGIN
    GET DIAGNOSTICS CONDITION 1 @p1 = RETURNED_SQLSTATE, @p2 = MYSQL_ERRNO, @p3 = MESSAGE_TEXT;
    CALL `mysql_task_management`.`add_task_log`(@task_id, 'error', json_object('error', @p3), 100, 'ERROR');
    END;

    CALL `mysql_task_management`.`add_task_log`(@task_id, 'Event execution started...', NULL, 0, 'RUNNING');
    SET @chat_options = options;
    CALL `sys`.`heatwave_chat`(prompt);
    CALL `mysql_task_management`.`add_task_log`(@task_id, 'Execution finished.', @chat_options, 100, 'COMPLETED');
END%%

DROP PROCEDURE IF EXISTS `chat`.`heatwave_chat_async`%%
CREATE DEFINER=`dba`@`%` PROCEDURE `chat`.`heatwave_chat_async`(IN `prompt` TEXT, IN `options` JSON, OUT task_id INT UNSIGNED)
    SQL SECURITY INVOKER
BEGIN
    CALL `chat`.`async_sql_execute`(
        'HeatWave Chat',
        'chat',
        CONCAT('CALL chat.do_async_chat(', quote(prompt), ',', quote(options), ');'),
        task_id);
END%%

DROP PROCEDURE IF EXISTS `chat`.`heatwave_chat_async_result`%%
CREATE DEFINER=`dba`@`%` PROCEDURE `chat`.`heatwave_chat_async_result`(IN task_id INT UNSIGNED, OUT `status` VARCHAR(20), OUT progress INT UNSIGNED, OUT `response` TEXT, OUT `chat_options` JSON)
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
