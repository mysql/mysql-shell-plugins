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

SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0;
SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0;
SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='ONLY_FULL_GROUP_BY,STRICT_TRANS_TABLES,NO_ZERO_IN_DATE,NO_ZERO_DATE,ERROR_FOR_DIVISION_BY_ZERO,NO_ENGINE_SUBSTITUTION';

ALTER TABLE `default_schema`.`module_data` 
ADD COLUMN `user_group_id` INT(11) NULL DEFAULT NULL AFTER `module_data_type_id`,
ADD COLUMN `group_data_privilege_id` INT(11) NULL DEFAULT NULL AFTER `user_group_id`,
ADD INDEX `fk_module_data_user_group1` (`user_group_id` ASC),
ADD INDEX `fk_module_data_module_data_privilege1` (`group_data_privilege_id` ASC);
;

CREATE TABLE IF NOT EXISTS `default_schema`.`user_group` (
  `id` INT(11) NOT NULL,
  `name` VARCHAR(45) NULL DEFAULT NULL,
  `description` VARCHAR(200) NULL DEFAULT NULL,
  `active` TINYINT(4) NULL DEFAULT NULL,
  PRIMARY KEY (`id`))
ENGINE = InnoDB
DEFAULT CHARACTER SET = utf8;

CREATE TABLE IF NOT EXISTS `default_schema`.`user_group_has_user` (
  `user_group_id` INT(11) NOT NULL,
  `user_id` INT(11) NOT NULL,
  `owner` TINYINT(4) NULL DEFAULT NULL,
  PRIMARY KEY (`user_group_id`, `user_id`),
  INDEX `fk_user_group_has_user_user1` (`user_id` ASC),
  CONSTRAINT `fk_user_group_has_user_user_group1`
    FOREIGN KEY (`user_group_id`)
    REFERENCES `default_schema`.`user_group` (`id`)
    ON DELETE NO ACTION
    ON UPDATE NO ACTION,
  CONSTRAINT `fk_user_group_has_user_user1`
    FOREIGN KEY (`user_id`)
    REFERENCES `default_schema`.`user` (`id`)
    ON DELETE NO ACTION
    ON UPDATE NO ACTION)
ENGINE = InnoDB
DEFAULT CHARACTER SET = utf8;

ALTER TABLE `default_schema`.`module_data` 
ADD CONSTRAINT `fk_module_data_user_group1`
  FOREIGN KEY (`user_group_id`)
  REFERENCES `default_schema`.`user_group` (`id`)
  ON DELETE NO ACTION
  ON UPDATE NO ACTION,
ADD CONSTRAINT `fk_module_data_module_data_privilege1`
  FOREIGN KEY (`group_data_privilege_id`)
  REFERENCES `default_schema`.`module_data_privilege` (`id`)
  ON DELETE NO ACTION
  ON UPDATE NO ACTION;


SET SQL_MODE=@OLD_SQL_MODE;
SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS;
SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS;
