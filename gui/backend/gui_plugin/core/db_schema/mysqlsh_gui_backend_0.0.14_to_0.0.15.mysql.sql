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

SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0;
SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0;
SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='ONLY_FULL_GROUP_BY,STRICT_TRANS_TABLES,NO_ZERO_IN_DATE,NO_ZERO_DATE,ERROR_FOR_DIVISION_BY_ZERO,NO_ENGINE_SUBSTITUTION';


-- -----------------------------------------------------
-- Table `profile_has_db_connection`
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS `profile_has_db_connection_new` (
  `profile_id` INT NOT NULL,
  `db_connection_id` INT NOT NULL,
  `folder_path` VARCHAR(1024) NULL,
  `index` INT NULL,
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
    ON UPDATE NO ACTION)
ENGINE = InnoDB;

INSERT INTO `profile_has_db_connection_new`
  SELECT `profile_id`, `db_connection_id`, `folder_path`, 1
  FROM `profile_has_db_connection`;

DROP TABLE `profile_has_db_connection`;
ALTER TABLE `profile_has_db_connection_new` RENAME TO `profile_has_db_connection`;

CREATE INDEX `fk_profile_has_db_connection_db_connection1_idx` ON `profile_has_db_connection` (`db_connection_id` ASC) VISIBLE;
CREATE INDEX `fk_profile_has_db_connection_user_profile1_idx` ON `profile_has_db_connection` (`profile_id` ASC) VISIBLE;

-- -----------------------------------------------------
-- View `schema_version`
-- -----------------------------------------------------
DROP VIEW IF EXISTS `schema_version` ;
CREATE VIEW schema_version (major, minor, patch) AS SELECT 0, 0, 15;

SET SQL_MODE=@OLD_SQL_MODE;
SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS;
SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS;
