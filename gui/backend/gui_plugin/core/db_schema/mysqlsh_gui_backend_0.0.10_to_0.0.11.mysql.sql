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

SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0;
SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0;
SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='ONLY_FULL_GROUP_BY,STRICT_TRANS_TABLES,NO_ZERO_IN_DATE,NO_ZERO_DATE,ERROR_FOR_DIVISION_BY_ZERO,NO_ENGINE_SUBSTITUTION';

-- -----------------------------------------------------
-- Table `module_data_category`
-- -----------------------------------------------------
DROP TABLE IF EXISTS `module_data_type` ;

CREATE TABLE IF NOT EXISTS `module_data_category` (
  `id` INT NOT NULL,
  `parent_category_id` INT NULL,
  `caption` VARCHAR(80) NULL,
  `module_id` VARCHAR(256) NULL DEFAULT NULL,
  `active` TINYINT NULL DEFAULT 1,
  PRIMARY KEY (`id`),
  INDEX `fk_module_data_category_module_data_category1_idx` (`parent_category_id` ASC) VISIBLE,
  CONSTRAINT `fk_module_data_category_module_data_category1`
    FOREIGN KEY (`parent_category_id`)
    REFERENCES `module_data_category` (`id`)
    ON DELETE CASCADE
    ON UPDATE NO ACTION)
ENGINE = InnoDB;

-- -----------------------------------------------------
-- Table `module_data`
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS `module_data_new` (
  `id` INT NOT NULL,
  `module_id` VARCHAR(256) NOT NULL,
  `module_data_category_id` INT NOT NULL,
  `caption` VARCHAR(256) NULL,
  `content` TEXT NULL,
  `created` DATETIME NULL,
  `last_update` DATETIME NULL,
  PRIMARY KEY (`id`),
  INDEX `fk_module_data_module4_idx` (`module_id` ASC) VISIBLE,
  INDEX `fk_module_data_module_data_category4_idx` (`module_data_category_id` ASC) VISIBLE,
  INDEX `module_data_caption4_idx` (`caption` ASC) VISIBLE,
  CONSTRAINT `fk_module_data_module1`
    FOREIGN KEY (`module_id`)
    REFERENCES `module` (`id`)
    ON DELETE CASCADE
    ON UPDATE NO ACTION,
  CONSTRAINT `fk_module_data_module_data_category1`
    FOREIGN KEY (`module_data_category_id`)
    REFERENCES `module_data_category` (`id`)
    ON DELETE RESTRICT
    ON UPDATE NO ACTION)
ENGINE = InnoDB;

INSERT INTO `module_data_new`
  SELECT `id`, `module_id`, `module_data_type_id`, `caption`, `content`, `created`, `last_update`
  FROM `module_data`;

DROP TABLE `module_data`;
ALTER TABLE `module_data_new` RENAME TO `module_data`;

-- -----------------------------------------------------
-- Placeholder table for view `schema_version`
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS `schema_version` (`major` INT, `minor` INT, `patch` INT);

-- -----------------------------------------------------
-- View `schema_version`
-- -----------------------------------------------------
DROP TABLE IF EXISTS `schema_version`;
DROP VIEW IF EXISTS `schema_version` ;
CREATE VIEW schema_version (major, minor, patch) AS SELECT 0, 0, 11;

-- -----------------------------------------------------
-- Data for table `module_data_category`
-- -----------------------------------------------------
START TRANSACTION;
INSERT INTO `module_data_category` (`id`, `parent_category_id`, `caption`, `module_id`) VALUES (0, NULL, 'Module Data', NULL);
INSERT INTO `module_data_category` (`id`, `parent_category_id`, `caption`, `module_id`) VALUES (1, 0, 'File', NULL);
INSERT INTO `module_data_category` (`id`, `parent_category_id`, `caption`, `module_id`) VALUES (2, 1, 'Script', NULL);
INSERT INTO `module_data_category` (`id`, `parent_category_id`, `caption`, `module_id`) VALUES (3, 1, 'JSON', NULL);
INSERT INTO `module_data_category` (`id`, `parent_category_id`, `caption`, `module_id`) VALUES (4, 0, 'File Link', NULL);
INSERT INTO `module_data_category` (`id`, `parent_category_id`, `caption`, `module_id`) VALUES (5, 2, 'MySQL Script', NULL);
INSERT INTO `module_data_category` (`id`, `parent_category_id`, `caption`, `module_id`) VALUES (6, 2, 'Python Script', NULL);
INSERT INTO `module_data_category` (`id`, `parent_category_id`, `caption`, `module_id`) VALUES (7, 2, 'JavaScript Script', NULL);
INSERT INTO `module_data_category` (`id`, `parent_category_id`, `caption`, `module_id`) VALUES (8, 2, 'TypeScript Script', NULL);
INSERT INTO `module_data_category` (`id`, `parent_category_id`, `caption`, `module_id`) VALUES (9, 2, 'SQLite Script', NULL);

COMMIT;

SET SQL_MODE=@OLD_SQL_MODE;
SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS;
SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS;
