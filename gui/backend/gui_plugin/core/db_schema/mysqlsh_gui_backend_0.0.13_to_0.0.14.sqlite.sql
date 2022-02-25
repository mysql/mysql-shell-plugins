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
-- Table `profile`
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS `profile_new` (
  `id` INTEGER NOT NULL,
  `user_id` INTEGER NOT NULL,
  `name` VARCHAR(80) NULL,
  `description` VARCHAR(200) NULL,
  `options` TEXT NULL,
  PRIMARY KEY (`id`),
  CONSTRAINT `fk_profile_user1`
    FOREIGN KEY (`user_id`)
    REFERENCES `user` (`id`)
    ON DELETE NO ACTION
    ON UPDATE NO ACTION);

INSERT INTO `profile_new`
  SELECT `id`, `user_id`, `name`, `description`, `options`
  FROM `profile`
  WHERE `active` = 1;

DROP TABLE `profile`;
ALTER TABLE `profile_new` RENAME TO `profile`;

CREATE INDEX `fk_profile_user1_idx` ON `profile` (`user_id` ASC);

-- -----------------------------------------------------
-- Table `profile_has_db_connection`
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS `profile_has_db_connection_new` (
  `profile_id` INTEGER NOT NULL,
  `db_connection_id` INTEGER NOT NULL,
  `folder_path` VARCHAR(1024) NULL,
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
  SELECT `profile_id`, `db_connection_id`, `folder_path`
  FROM `profile_has_db_connection`
  WHERE `active` = 1;

DROP TABLE `profile_has_db_connection`;
ALTER TABLE `profile_has_db_connection_new` RENAME TO `profile_has_db_connection`;

CREATE INDEX `fk_profile_has_db_connection_db_connection1_idx` ON `profile_has_db_connection` (`db_connection_id` ASC);
CREATE INDEX `fk_profile_has_db_connection_user_profile1_idx` ON `profile_has_db_connection` (`profile_id` ASC);

-- -----------------------------------------------------
-- Table `user`
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS `user_new` (
  `id` INTEGER NOT NULL,
  `default_profile_id` INTEGER NULL,
  `name` VARCHAR(45) NULL,
  `password_hash` VARCHAR(256) NULL,
  `allowed_hosts` VARCHAR(512) NULL,
  PRIMARY KEY (`id`),
  CONSTRAINT `fk_user_profile1`
    FOREIGN KEY (`default_profile_id`)
    REFERENCES `profile` (`id`)
    ON DELETE NO ACTION
    ON UPDATE NO ACTION);

INSERT INTO `user_new`
  SELECT `id`, `default_profile_id`, `name`, `password_hash`, `allowed_hosts`
  FROM `user`
  WHERE `active` = 1;

DROP TABLE `user`;
ALTER TABLE `user_new` RENAME TO `user`;

CREATE INDEX `fk_user_profile1_idx` ON `user` (`default_profile_id` ASC);
CREATE UNIQUE INDEX `name_UNIQUE` ON `user` (`name` ASC);

-- -----------------------------------------------------
-- Table `user_group`
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS `user_group_new` (
  `id` INTEGER NOT NULL,
  `name` VARCHAR(45) NULL,
  `description` VARCHAR(200) NULL,
  PRIMARY KEY (`id`));

INSERT INTO `user_group_new`
  SELECT `id`, `name`, `description`
  FROM `user_group`
  WHERE `active` = 1;

DROP TABLE `user_group`;
ALTER TABLE `user_group_new` RENAME TO `user_group`;

-- -----------------------------------------------------
-- Table `user_group_has_user`
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS `user_group_has_user_new` (
  `user_group_id` INTEGER NOT NULL,
  `user_id` INTEGER NOT NULL,
  `owner` TINYINT NULL,
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

INSERT INTO `user_group_has_user_new`
  SELECT `user_group_id`, `user_id`, `owner`
  FROM `user_group_has_user`
  WHERE `active` = 1;

DROP TABLE `user_group_has_user`;
ALTER TABLE `user_group_has_user_new` RENAME TO `user_group_has_user`;

CREATE INDEX `fk_user_group_has_user_user1_idx` ON `user_group_has_user` (`user_id` ASC);
CREATE INDEX `fk_user_group_has_user_user_group1_idx` ON `user_group_has_user` (`user_group_id` ASC);

-- -----------------------------------------------------
-- View `schema_version`
-- -----------------------------------------------------
DROP VIEW IF EXISTS `schema_version` ;
CREATE VIEW schema_version (major, minor, patch) AS SELECT 0, 0, 14;


PRAGMA foreign_keys = ON;

