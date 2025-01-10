/*
 * Copyright (c) 2025, Oracle and/or its affiliates.
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

SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0;
SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0;
SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='ONLY_FULL_GROUP_BY,STRICT_TRANS_TABLES,NO_ZERO_IN_DATE,NO_ZERO_DATE,ERROR_FOR_DIVISION_BY_ZERO,NO_ENGINE_SUBSTITUTION';

-- -----------------------------------------------------
-- Table `folder_path`
-- -----------------------------------------------------
DROP TABLE IF EXISTS `folder_path` ;

CREATE TABLE IF NOT EXISTS `folder_path` (
  `id` INT NOT NULL,
  `parent_folder_id` INT NULL,
  `caption` VARCHAR(256) NOT NULL,
  `index` INT NULL,
  PRIMARY KEY (`id`),
  INDEX `fk_folder_path_folder_path1_idx` (`parent_folder_id` ASC) VISIBLE,
  INDEX `index_idx` (`index` ASC) VISIBLE,
  CONSTRAINT `fk_folder_path_folder_path1`
    FOREIGN KEY (`parent_folder_id`)
    REFERENCES `folder_path` (`id`)
    ON DELETE NO ACTION
    ON UPDATE NO ACTION)
ENGINE = InnoDB

-- -----------------------------------------------------
-- Table `profile_has_db_connection`
-- -----------------------------------------------------

-- Drop the existing foreign key constraints
ALTER TABLE `profile_has_db_connection` DROP FOREIGN KEY `fk_profile_has_db_connection_profile1`;
ALTER TABLE `profile_has_db_connection` DROP FOREIGN KEY `fk_profile_has_db_connection_db_connection1`;

-- Modify the table structure
ALTER TABLE `profile_has_db_connection`
  CHANGE COLUMN `folder_path` `folder_path_id` INT NOT NULL,
  DROP INDEX `folder_path_idx`,
  ADD INDEX `fk_profile_has_db_connection_folder_path1_idx` (`folder_path_id` ASC) VISIBLE;

-- Add the updated foreign key constraints
ALTER TABLE `profile_has_db_connection`
  ADD CONSTRAINT `fk_profile_has_db_connection_profile1`
    FOREIGN KEY (`profile_id`)
    REFERENCES `profile` (`id`)
    ON DELETE NO ACTION
    ON UPDATE NO ACTION,
  ADD CONSTRAINT `fk_profile_has_db_connection_db_connection1`
    FOREIGN KEY (`db_connection_id`)
    REFERENCES `db_connection` (`id`)
    ON DELETE NO ACTION
    ON UPDATE NO ACTION,
  ADD CONSTRAINT `fk_profile_has_db_connection_folder_path1`
    FOREIGN KEY (`folder_path_id`)
    REFERENCES `folder_path` (`id`)
    ON DELETE NO ACTION
    ON UPDATE NO ACTION;

-- -----------------------------------------------------
-- Data for table `folder_path`
-- -----------------------------------------------------
START TRANSACTION;
INSERT INTO `folder_path` (`id`, `parent_folder_id`, `caption`, `index`) VALUES (1, NULL, '/', 0);

COMMIT;

-- -----------------------------------------------------
-- View `schema_version`
-- -----------------------------------------------------
DROP VIEW IF EXISTS `schema_version` ;
CREATE VIEW schema_version (major, minor, patch) AS SELECT 0, 0, 19;

SET SQL_MODE=@OLD_SQL_MODE;
SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS;
SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS;
