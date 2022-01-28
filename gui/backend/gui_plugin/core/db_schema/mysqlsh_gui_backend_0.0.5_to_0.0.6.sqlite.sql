/*
 * Copyright (c) 2021, Oracle and/or its affiliates.
 *
 * This program is free software; you can redistribute it and/or modify
 * it under the terms of the GNU General Public License, version 2.0,
 * as published by the Free Software Foundation.
 *
 * This program is also distributed with certain software (including
 * but not limited to OpenSSL) that is licensed under separate terms, as
 * designated in a particular file or component or in included license
 * documentation.  The authors of MySQL hereby grant you an additional
 * permission to link the program and your derivative works with the
 * separately licensed software that they have included with MySQL.
 * This program is distributed in the hope that it will be useful,  but
 * WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See
 * the GNU General Public License, version 2.0, for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program; if not, write to the Free Software Foundation, Inc.,
 * 51 Franklin St, Fifth Floor, Boston, MA 02110-1301 USA
 */

-- MySQL Workbench Synchronization

-- MySQL Workbench Synchronization
-- Generated: 2021-03-18 15:17
-- Model: New Model
-- Version: 1.0
-- Project: Name of the project
-- Author: Mike Zinner


PRAGMA foreign_keys = OFF;


CREATE TABLE IF NOT EXISTS `db_connection_new` (
  `id` INTEGER NOT NULL,
  `db_type` VARCHAR(45) NOT NULL,
  `caption` VARCHAR(256) NULL,
  `description` VARCHAR(200) NULL,
  `options` TEXT NULL,
  PRIMARY KEY (`id`));

INSERT INTO `db_connection_new` SELECT c.id, t.name as db_type, c.caption, c.description, c.options
FROM db_connection c
LEFT JOIN db_type t
ON c.db_type_id = t.id;

DROP TABLE `db_connection`;

ALTER TABLE `db_connection_new` RENAME TO `db_connection`;

DROP TABLE IF EXISTS `gui_backend`.`db_type` ;


PRAGMA foreign_keys = ON;

