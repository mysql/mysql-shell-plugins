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
-- Table `user_group_has_user`
-- -----------------------------------------------------
DROP TABLE IF EXISTS `user_group_has_user_new` ;

CREATE TABLE IF NOT EXISTS `user_group_has_user_new` (
  `user_group_id` INT NOT NULL,
  `user_id` INT NOT NULL,
  `owner` TINYINT NULL,
  `active` TINYINT NULL,
  PRIMARY KEY (`user_group_id`, `user_id`),
  INDEX `fk_user_group_has_user_user2_idx` (`user_id` ASC) VISIBLE,
  INDEX `fk_user_group_has_user_user_group2_idx` (`user_group_id` ASC) VISIBLE,
  CONSTRAINT `fk_user_group_has_user_user_group1`
    FOREIGN KEY (`user_group_id`)
    REFERENCES `user_group` (`id`)
    ON DELETE NO ACTION
    ON UPDATE NO ACTION,
  CONSTRAINT `fk_user_group_has_user_user1`
    FOREIGN KEY (`user_id`)
    REFERENCES `user` (`id`)
    ON DELETE NO ACTION
    ON UPDATE NO ACTION)
ENGINE = InnoDB;

INSERT INTO `user_group_has_user_new`
  SELECT `user_group_id`, `user_id`, `owner`, `active`
  FROM `user_group_has_user`;

DROP TABLE `user_group_has_user`;
ALTER TABLE `user_group_has_user_new` RENAME TO `user_group_has_user`;

-- -----------------------------------------------------
-- Table `user_group_has_user`
-- -----------------------------------------------------
ALTER TABLE `user_group_has_module_data`
ADD COLUMN `folder_path` VARCHAR(1024) NULL;

ALTER TABLE `user_group_has_module_data`
ADD INDEX fk_user_group_has_module_data_folder_path2_idx (`folder_path`);


SET SQL_MODE=@OLD_SQL_MODE;
SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS;
SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS;
