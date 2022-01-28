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
-- Table `data_category`
-- -----------------------------------------------------
DROP TABLE IF EXISTS `module_data_category` ;

CREATE TABLE IF NOT EXISTS `data_category` (
  `id` INTEGER NOT NULL,
  `parent_category_id` INTEGER NULL,
  `name` VARCHAR(80) NULL,
  `module_id` VARCHAR(256) NULL,
  PRIMARY KEY (`id`),
  CONSTRAINT `fk_module_data_category_module_data_category1`
    FOREIGN KEY (`parent_category_id`)
    REFERENCES `data_category` (`id`)
    ON DELETE CASCADE
    ON UPDATE NO ACTION);

CREATE INDEX `fk_module_data_category_module_data_category1_idx` ON `data_category` (`parent_category_id` ASC);

CREATE UNIQUE INDEX `unique_caption_per_module_id` ON `data_category` (`name` ASC, `module_id` ASC);




-- -----------------------------------------------------
-- Table `data`
-- -----------------------------------------------------
DROP TABLE IF EXISTS `module_data` ;

CREATE TABLE IF NOT EXISTS `data` (
  `id` INTEGER NOT NULL,
  `data_category_id` INTEGER NOT NULL,
  `caption` VARCHAR(256) NULL,
  `content` TEXT NULL,
  `created` DATETIME NULL,
  `last_update` DATETIME NULL,
  PRIMARY KEY (`id`),
  CONSTRAINT `fk_data_data_category1`
    FOREIGN KEY (`data_category_id`)
    REFERENCES `data_category` (`id`)
    ON DELETE NO ACTION
    ON UPDATE NO ACTION);

CREATE INDEX `module_data_caption_idx` ON `data` (`caption` ASC);
CREATE INDEX `fk_data_data_category1_idx` ON `data` (`data_category_id` ASC);

-- -----------------------------------------------------
-- Table `module`
-- -----------------------------------------------------
DROP TABLE IF EXISTS `module` ;

-- -----------------------------------------------------
-- Table `profile_has_module_options`
-- -----------------------------------------------------
DROP TABLE IF EXISTS `profile_has_module_options` ;

-- -----------------------------------------------------
-- Table `user_group_has_module_data`
-- -----------------------------------------------------
DROP TABLE IF EXISTS `user_group_has_module_data` ;

-- -----------------------------------------------------
-- Table `profile_has_module_data`
-- -----------------------------------------------------
DROP TABLE IF EXISTS `profile_has_module_data` ;

-- -----------------------------------------------------
-- Table `module_data_privilege`
-- -----------------------------------------------------
DROP TABLE IF EXISTS `module_data_privilege` ;

-- -----------------------------------------------------
-- Table `data_folder`
-- -----------------------------------------------------
DROP TABLE IF EXISTS `data_folder` ;

CREATE TABLE IF NOT EXISTS `data_folder` (
  `id` INTEGER NOT NULL,
  `caption` VARCHAR(80) NULL,
  `parent_folder_id` INTEGER NULL,
  PRIMARY KEY (`id`),
  CONSTRAINT `fk_module_data_folder_module_data_folder1`
    FOREIGN KEY (`parent_folder_id`)
    REFERENCES `data_folder` (`id`)
    ON DELETE NO ACTION
    ON UPDATE NO ACTION);

CREATE INDEX `fk_module_data_folder_module_data_folder1_idx` ON `data_folder` (`parent_folder_id` ASC);




-- -----------------------------------------------------
-- Table `data_folder_has_data`
-- -----------------------------------------------------
DROP TABLE IF EXISTS `data_folder_has_data` ;

CREATE TABLE IF NOT EXISTS `data_folder_has_data` (
  `data_id` INTEGER NOT NULL,
  `data_folder_id` INTEGER NOT NULL,
  `read_only` TINYINT NOT NULL DEFAULT 0,
  PRIMARY KEY (`data_id`, `data_folder_id`),
  CONSTRAINT `fk_data_has_data_folder_data1`
    FOREIGN KEY (`data_id`)
    REFERENCES `data` (`id`)
    ON DELETE NO ACTION
    ON UPDATE NO ACTION,
  CONSTRAINT `fk_data_has_data_folder_data_folder1`
    FOREIGN KEY (`data_folder_id`)
    REFERENCES `data_folder` (`id`)
    ON DELETE NO ACTION
    ON UPDATE NO ACTION);

CREATE INDEX `fk_data_has_data_folder_data_folder1_idx` ON `data_folder_has_data` (`data_folder_id` ASC);

CREATE INDEX `fk_data_has_data_folder_data1_idx` ON `data_folder_has_data` (`data_id` ASC);




-- -----------------------------------------------------
-- Table `data_profile_tree`
-- -----------------------------------------------------
DROP TABLE IF EXISTS `data_profile_tree` ;

CREATE TABLE IF NOT EXISTS `data_profile_tree` (
  `profile_id` INTEGER NOT NULL,
  `root_folder_id` INTEGER NOT NULL,
  `tree_identifier` VARCHAR(45) NOT NULL,
  PRIMARY KEY (`profile_id`, `root_folder_id`),
  CONSTRAINT `fk_profile_has_module_data_folder_profile1`
    FOREIGN KEY (`profile_id`)
    REFERENCES `profile` (`id`)
    ON DELETE NO ACTION
    ON UPDATE NO ACTION,
  CONSTRAINT `fk_profile_has_module_data_folder_module_data_folder1`
    FOREIGN KEY (`root_folder_id`)
    REFERENCES `data_folder` (`id`)
    ON DELETE NO ACTION
    ON UPDATE NO ACTION);

CREATE INDEX `fk_profile_has_module_data_folder_profile1_idx` ON `data_profile_tree` (`profile_id` ASC);

CREATE INDEX `fk_profile_has_module_data_folder_module_data_folder1_idx` ON `data_profile_tree` (`root_folder_id` ASC);




-- -----------------------------------------------------
-- Table `data_user_group_tree`
-- -----------------------------------------------------
DROP TABLE IF EXISTS `data_user_group_tree` ;

CREATE TABLE IF NOT EXISTS `data_user_group_tree` (
  `user_group_id` INTEGER NOT NULL,
  `root_folder_id` INTEGER NOT NULL,
  `tree_identifier` VARCHAR(45) NOT NULL,
  PRIMARY KEY (`user_group_id`, `root_folder_id`),
  CONSTRAINT `fk_user_group_has_module_data_folder_user_group1`
    FOREIGN KEY (`user_group_id`)
    REFERENCES `user_group` (`id`)
    ON DELETE NO ACTION
    ON UPDATE NO ACTION,
  CONSTRAINT `fk_user_group_has_module_data_folder_module_data_folder1`
    FOREIGN KEY (`root_folder_id`)
    REFERENCES `data_folder` (`id`)
    ON DELETE NO ACTION
    ON UPDATE NO ACTION);

CREATE INDEX `fk_user_group_has_module_data_folder_user_group1_idx` ON `data_user_group_tree` (`user_group_id` ASC);

CREATE INDEX `fk_user_group_has_module_data_folder_module_data_folder1_idx` ON `data_user_group_tree` (`root_folder_id` ASC);





-- -----------------------------------------------------
-- View `schema_version`
-- -----------------------------------------------------
DROP VIEW IF EXISTS `schema_version` ;
CREATE VIEW schema_version (major, minor, patch) AS SELECT 0, 0, 12;


PRAGMA foreign_keys = ON;

