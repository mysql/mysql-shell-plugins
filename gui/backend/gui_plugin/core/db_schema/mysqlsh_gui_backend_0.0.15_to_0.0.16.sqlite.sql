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


DROP TABLE IF EXISTS `db_type` ;

-- -----------------------------------------------------
-- Table `data_has_tag`
-- -----------------------------------------------------
DROP TABLE IF EXISTS `module_data_has_tag` ;

-- -----------------------------------------------------
-- Table `data_has_tag`
-- -----------------------------------------------------
DROP TABLE IF EXISTS `data_has_tag` ;

CREATE TABLE IF NOT EXISTS `data_has_tag` (
  `profile_id` INTEGER NOT NULL,
  `data_id` INTEGER NOT NULL,
  `tag_id` INTEGER NOT NULL,
  PRIMARY KEY (`profile_id`, `data_id`, `tag_id`),
  CONSTRAINT `fk_data_has_tag_tag1`
    FOREIGN KEY (`tag_id`)
    REFERENCES `tag` (`id`)
    ON DELETE NO ACTION
    ON UPDATE NO ACTION);

CREATE INDEX `fk_data_has_tag_tag1_idx` ON `data_has_tag` (`tag_id` ASC);




-- -----------------------------------------------------
-- View `schema_version`
-- -----------------------------------------------------
DROP VIEW IF EXISTS `schema_version` ;
CREATE VIEW schema_version (major, minor, patch) AS SELECT 0, 0, 16;


PRAGMA foreign_keys = ON;

