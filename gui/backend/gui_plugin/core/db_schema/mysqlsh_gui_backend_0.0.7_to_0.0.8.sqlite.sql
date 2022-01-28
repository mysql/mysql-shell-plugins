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


PRAGMA foreign_keys = OFF;


-- -----------------------------------------------------
-- Table `user_group_has_module_data`
-- -----------------------------------------------------
DROP TABLE IF EXISTS `user_group_has_module_data` ;

CREATE TABLE IF NOT EXISTS `user_group_has_module_data` (
  `active` TINYINT NOT NULL,
  `user_group_id` INTEGER NOT NULL,
  `module_data_id` INTEGER NOT NULL,
  `module_data_privilege_id` INTEGER NOT NULL,
  CONSTRAINT `fk_user_group_has_module_data_user_group1`
    FOREIGN KEY (`user_group_id`)
    REFERENCES `user_group` (`id`)
    ON DELETE NO ACTION
    ON UPDATE NO ACTION,
  CONSTRAINT `fk_user_group_has_module_data_module_data1`
    FOREIGN KEY (`module_data_id`)
    REFERENCES `module_data` (`id`)
    ON DELETE NO ACTION
    ON UPDATE NO ACTION,
  CONSTRAINT `fk_user_group_has_module_data_module_data_privilege1`
    FOREIGN KEY (`module_data_privilege_id`)
    REFERENCES `module_data_privilege` (`id`)
    ON DELETE NO ACTION
    ON UPDATE NO ACTION);

CREATE INDEX `fk_user_group_has_module_data_user_group1_idx` ON `user_group_has_module_data` (`user_group_id` ASC);

CREATE INDEX `fk_user_group_has_module_data_module_data1_idx` ON `user_group_has_module_data` (`module_data_id` ASC);

CREATE INDEX `fk_user_group_has_module_data_module_data_privilege1_idx` ON `user_group_has_module_data` (`module_data_privilege_id` ASC);




-- -----------------------------------------------------
-- Table `module_data`
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS `module_data_new` (
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
    ON UPDATE NO ACTION);

CREATE INDEX `fk_module_data_module2_idx` ON `module_data_new` (`module_id` ASC);

CREATE INDEX `fk_module_data_module_data_type2_idx` ON `module_data_new` (`module_data_type_id` ASC);

CREATE INDEX `module_data_caption2_idx` ON `module_data_new` (`caption` ASC);

CREATE INDEX `module_data_folder_path2_idx` ON `module_data_new` (`folder_path` ASC);




INSERT INTO `module_data_new`
  SELECT `id`, `module_id`, `module_data_type_id`, `caption`,
          `folder_path`, `content`, `created`, `last_update`
  FROM `module_data`;

INSERT INTO `user_group_has_module_data`(`active`, `user_group_id`, `module_data_id`, `module_data_privilege_id`)
  SELECT 1, `user_group_id`, `id`, `group_data_privilege_id`
  FROM `module_data`;

DROP TABLE `module_data`;
ALTER TABLE `module_data_new` RENAME TO `module_data`;

-- -----------------------------------------------------
-- Table `user_group_has_user`
-- -----------------------------------------------------
ALTER TABLE `user_group_has_user`
  ADD COLUMN `active` TINYINT NULL  DEFAULT 1;



-- -----------------------------------------------------
-- Table `module_data_type`
-- -----------------------------------------------------
ALTER TABLE `module_data_type`
  ADD COLUMN `active` TINYINT NULL  DEFAULT 1;



-- -----------------------------------------------------
-- Data for table `user_group`
-- -----------------------------------------------------
BEGIN TRANSACTION;
INSERT INTO `user_group` (`id`, `name`, `description`, `active`) VALUES (1, 'all', 'All Users', 1);
COMMIT;

BEGIN TRANSACTION;
INSERT INTO `user_group`(`name`, `description`, `active`)
SELECT `name`, `name` || " default group", 1 FROM `user`;
COMMIT;

BEGIN TRANSACTION;
INSERT INTO `user_group_has_user`(`user_group_id`, `user_id`, `owner`, `active`)
SELECT `ug`.`id`, `u`.`id`, `u`.`id`, 1
FROM `user_group` `ug`, `user` `u`
WHERE `ug`.`name` = `u`.`name`;
COMMIT;

BEGIN TRANSACTION;
INSERT INTO `user_group_has_user`(`user_group_id`, `user_id`, `owner`, `active`)
SELECT 1, `id`, NULL, 1
FROM `user`;
COMMIT;


PRAGMA foreign_keys = ON;

