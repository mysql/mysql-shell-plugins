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

-- -----------------------------------------------------
-- Copy data from the previous version, leave the old data in place
-- -----------------------------------------------------

INSERT INTO `mysql_tasks`.`task_impl`
(id, alias, `mysql_user`, server_uuid, name, connection_id, thread_id, task_type, data)
SELECT UUID_TO_BIN(UUID(), 1), `id`, `user`, UUID_TO_BIN(@@server_uuid, 1), `name`, `connection_id`, `thread_id`, COALESCE(`task_type`, 'default'), `data`
FROM `mysql_task_management`.`task_impl`;

INSERT INTO `mysql_tasks`.`task_log_impl`
(id, `mysql_user`, server_uuid, task_id, log_time, message, data, progress, status)
SELECT `id`, `user`, UUID_TO_BIN(@@server_uuid, 1), `task_id`, `log_time`, `message`, `data`, `progress`, `status`
FROM `mysql_task_management`.`task_log_impl`;

