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
-- Table `module_data`
-- -----------------------------------------------------

CREATE TABLE IF NOT EXISTS `module_data_new` (
  `id` INTEGER NOT NULL,
  `module_id` VARCHAR(256) NOT NULL,
  `module_data_type_id` INTEGER NOT NULL,
  `caption` VARCHAR(256) NULL,
  `content` TEXT NULL,
  `created` DATETIME NULL,
  `last_update` DATETIME NULL,
  PRIMARY KEY (`id`),
  CONSTRAINT `fk_module_data_module1`
    FOREIGN KEY (`module_id`)
    REFERENCES `module` (`id`)
    ON DELETE NO ACTION
    ON UPDATE NO ACTION,
  CONSTRAINT `fk_module_data_module_data_type1`
    FOREIGN KEY (`module_data_type_id`)
    REFERENCES `module_data_type` (`id`)
    ON DELETE NO ACTION
    ON UPDATE NO ACTION);

CREATE INDEX `fk_module_data_module3_idx` ON `module_data_new` (`module_id` ASC);

CREATE INDEX `fk_module_data_module_data_type3_idx` ON `module_data_new` (`module_data_type_id` ASC);

CREATE INDEX `module_data_caption3_idx` ON `module_data_new` (`caption` ASC);




INSERT INTO `module_data_new`
  SELECT `id`, `module_id`, `module_data_type_id`, `caption`,
          `content`, `created`, `last_update`
  FROM `module_data`;

DROP TABLE `module_data`;
ALTER TABLE `module_data_new` RENAME TO `module_data`;

-- -----------------------------------------------------
-- Table `user_group_has_user`
-- -----------------------------------------------------
ALTER TABLE `user_group_has_user`
  ADD COLUMN `folder_path` VARCHAR(1024) NULL;



CREATE INDEX fk_user_group_has_module_data_folder_path1_idx ON `user_group_has_user` (`folder_path`);



-- -----------------------------------------------------
-- Table `profile_has_module_data`
-- -----------------------------------------------------
ALTER TABLE `profile_has_module_data`
  ADD COLUMN `folder_path` VARCHAR(1024) NULL;



CREATE INDEX fk_profile_has_module_data_folder_path1_idx ON `profile_has_module_data` (`folder_path`);



-- -----------------------------------------------------
-- Table `module_data_type`
-- -----------------------------------------------------
ALTER TABLE `module_data_type`
  ADD COLUMN `module_id` VARCHAR(256) NULL;





PRAGMA foreign_keys = ON;

