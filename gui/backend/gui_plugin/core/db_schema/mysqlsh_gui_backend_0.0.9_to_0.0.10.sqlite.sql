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
-- Table `user_group_has_user`
-- -----------------------------------------------------
DROP TABLE IF EXISTS `user_group_has_user_new` ;

CREATE TABLE IF NOT EXISTS `user_group_has_user_new` (
  `user_group_id` INTEGER NOT NULL,
  `user_id` INTEGER NOT NULL,
  `owner` TINYINT NULL,
  `active` TINYINT NULL,
  PRIMARY KEY (`user_group_id`, `user_id`),
  CONSTRAINT `fk_user_group_has_user_user_group1`
    FOREIGN KEY (`user_group_id`)
    REFERENCES `user_group` (`id`)
    ON DELETE NO ACTION
    ON UPDATE NO ACTION,
  CONSTRAINT `fk_user_group_has_user_user1`
    FOREIGN KEY (`user_id`)
    REFERENCES `user` (`id`)
    ON DELETE NO ACTION
    ON UPDATE NO ACTION);

CREATE INDEX `fk_user_group_has_user_user2_idx` ON `user_group_has_user_new` (`user_id` ASC);

CREATE INDEX `fk_user_group_has_user_user_group2_idx` ON `user_group_has_user_new` (`user_group_id` ASC);




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



CREATE INDEX fk_user_group_has_module_data_folder_path2_idx ON `user_group_has_module_data` (`folder_path`);





PRAGMA foreign_keys = ON;

