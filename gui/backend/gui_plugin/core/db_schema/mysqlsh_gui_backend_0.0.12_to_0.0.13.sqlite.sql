/*
 * Copyright (c) 2022, Oracle and/or its affiliates.
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

CREATE TABLE IF NOT EXISTS `data_category_new` (
  `id` INTEGER NOT NULL,
  `parent_category_id` INTEGER NULL,
  `name` VARCHAR(80) NULL,
  PRIMARY KEY (`id`),
  CONSTRAINT `fk_module_data_category_module_data_category1`
    FOREIGN KEY (`parent_category_id`)
    REFERENCES `data_category` (`id`)
    ON DELETE RESTRICT
    ON UPDATE NO ACTION);

INSERT INTO `data_category_new`
  SELECT `id`, `parent_category_id`, `name`
  FROM `data_category`;

DROP TABLE `data_category`;
ALTER TABLE `data_category_new` RENAME TO `data_category`;

CREATE INDEX `fk_module_data_category_module_data_category1_idx` ON `data_category` (`parent_category_id` ASC);

-- -----------------------------------------------------
-- View `schema_version`
-- -----------------------------------------------------
DROP VIEW IF EXISTS `schema_version` ;
CREATE VIEW schema_version (major, minor, patch) AS SELECT 0, 0, 13;

-- -----------------------------------------------------
-- Data for table `data_category`
-- -----------------------------------------------------
BEGIN TRANSACTION;
INSERT INTO `data_category` (`id`, `parent_category_id`, `name`) VALUES (1, NULL, 'Text');
INSERT INTO `data_category` (`id`, `parent_category_id`, `name`) VALUES (2, 1, 'Script');
INSERT INTO `data_category` (`id`, `parent_category_id`, `name`) VALUES (3, 1, 'JSON');
INSERT INTO `data_category` (`id`, `parent_category_id`, `name`) VALUES (4, 2, 'MySQL Script');
INSERT INTO `data_category` (`id`, `parent_category_id`, `name`) VALUES (5, 2, 'Python Script');
INSERT INTO `data_category` (`id`, `parent_category_id`, `name`) VALUES (6, 2, 'JavaScript Script');
INSERT INTO `data_category` (`id`, `parent_category_id`, `name`) VALUES (7, 2, 'TypeScript Script');
INSERT INTO `data_category` (`id`, `parent_category_id`, `name`) VALUES (8, 2, 'SQLite Script');

COMMIT;


PRAGMA foreign_keys = ON;

