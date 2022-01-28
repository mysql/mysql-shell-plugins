/*
 * Copyright (c) 2020, 2021, Oracle and/or its affiliates.
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


PRAGMA foreign_keys = OFF;


ALTER TABLE `module_data`
  ADD COLUMN `user_group_id` INT(11) NULL;

ALTER TABLE `module_data`
  ADD COLUMN `group_data_privilege_id` INT(11) NULL;

CREATE INDEX `fk_module_data_user_group1` ON `module_data` (`user_group_id` ASC);

CREATE INDEX `fk_module_data_module_data_privilege1` ON `module_data` (`group_data_privilege_id` ASC);



CREATE TABLE IF NOT EXISTS `user_group` (
  `id` INT(11) NOT NULL,
  `name` VARCHAR(45) NULL,
  `description` VARCHAR(200) NULL,
  `active` TINYINT(4) NULL,
  PRIMARY KEY (`id`));

CREATE TABLE IF NOT EXISTS `user_group_has_user` (
  `user_group_id` INT(11) NOT NULL,
  `user_id` INT(11) NOT NULL,
  `owner` TINYINT(4) NULL,
  PRIMARY KEY (`user_group_id`, `user_id`),
  CONSTRAINT `fk_user_group_has_user_user_group1`
    FOREIGN KEY (`user_group_id`)
    REFERENCES `user_group` (`id`)
    ON DELETE NO ACTION
    ON UPDATE NO ACTION,
  CONSTRAINT `fk_user_group_has_user_user1`
    FOREIGN KEY (`user_id`)
    REFERENCES `user` (`id`)
    ON DELETE NO ACTION
    ON UPDATE NO ACTION);

CREATE INDEX `fk_user_group_has_user_user1` ON `user_group_has_user` (`user_id` ASC);




-- Add constraints to table module_data
CREATE TABLE IF NOT EXISTS `module_data__tmp__` (
  `id` INTEGER NOT NULL,
  `module_id` VARCHAR(256) NOT NULL,
  `module_data_type_id` INTEGER NOT NULL,
  `caption` VARCHAR(256) NULL,
  `folder_path` VARCHAR(1024) NULL,
  `content` TEXT NULL,
  `created` DATETIME NULL,
  `last_update` DATETIME NULL,
  PRIMARY KEY (`id`),
  CONSTRAINT `fk_module_data_module1`
    FOREIGN KEY (`module_id`)
    REFERENCES `module` (`id`)
    ON DELETE NO ACTION
    ON UPDATE NO ACTION,
  CONSTRAINT `fk_module_data_module_data_type1`
    FOREIGN KEY (`module_data_type_id`)
    REFERENCES `module_data_type` (`id`)
    ON DELETE NO ACTION
    ON UPDATE NO ACTION);;
INSERT INTO `module_data__tmp__`(`id`, `module_id`, `module_data_type_id`, `caption`, `folder_path`, `content`, `created`, `last_update`) SELECT `id`, `module_id`, `module_data_type_id`, `caption`, `folder_path`, `content`, `created`, `last_update` FROM `module_data`;
DROP TABLE `module_data`;
ALTER TABLE `module_data__tmp__` RENAME TO `module_data`;





PRAGMA foreign_keys = ON;

