/*
 * Copyright (c) 2022, 2024, Oracle and/or its affiliates.
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


PRAGMA foreign_keys = OFF;



-- -----------------------------------------------------
-- Table `profile_has_db_connection`
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS `profile_has_db_connection_new` (
  `profile_id` INTEGER NOT NULL,
  `db_connection_id` INTEGER NOT NULL,
  `folder_path` VARCHAR(1024) NULL,
  `index` INTEGER NULL,
  PRIMARY KEY (`profile_id`, `db_connection_id`),
  CONSTRAINT `fk_profile_has_db_connection_profile1`
    FOREIGN KEY (`profile_id`)
    REFERENCES `profile` (`id`)
    ON DELETE NO ACTION
    ON UPDATE NO ACTION,
  CONSTRAINT `fk_profile_has_db_connection_db_connection1`
    FOREIGN KEY (`db_connection_id`)
    REFERENCES `db_connection` (`id`)
    ON DELETE NO ACTION
    ON UPDATE NO ACTION);

INSERT INTO `profile_has_db_connection_new`
  SELECT `profile_id`, `db_connection_id`, `folder_path`, 1
  FROM `profile_has_db_connection`;

DROP TABLE `profile_has_db_connection`;
ALTER TABLE `profile_has_db_connection_new` RENAME TO `profile_has_db_connection`;

CREATE INDEX `fk_profile_has_db_connection_db_connection1_idx` ON `profile_has_db_connection` (`db_connection_id` ASC);
CREATE INDEX `fk_profile_has_db_connection_user_profile1_idx` ON `profile_has_db_connection` (`profile_id` ASC);

-- -----------------------------------------------------
-- View `schema_version`
-- -----------------------------------------------------
DROP VIEW IF EXISTS `schema_version` ;
CREATE VIEW schema_version (major, minor, patch) AS SELECT 0, 0, 15;


PRAGMA foreign_keys = ON;
