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
-- Schema logs
-- -----------------------------------------------------

ATTACH DATABASE 'mysqlsh_gui_backend_log_0.0.7.sqlite3' as logs;

-- -----------------------------------------------------
-- Table `log`
-- -----------------------------------------------------

CREATE TABLE IF NOT EXISTS `logs`.`log` (
  `id` INTEGER NOT NULL,
  `session_id` INTEGER NULL,
  `user_id` INTEGER NULL,
  `event_time` DATETIME NULL,
  `event_type` VARCHAR(45) NULL,
  `message` TEXT NULL,
  PRIMARY KEY (`id`),
  CONSTRAINT `fk_log_user1`
    FOREIGN KEY (`user_id`)
    REFERENCES `user` (`id`)
    ON DELETE NO ACTION
    ON UPDATE NO ACTION,
  CONSTRAINT `fk_log_session1`
    FOREIGN KEY (`session_id`)
    REFERENCES `session` (`id`)
    ON DELETE NO ACTION
    ON UPDATE NO ACTION);;

-- CREATE UNIQUE INDEX `session_id_UNIQUE` ON `logs`.`log` (`session_id` ASC);
-- CREATE UNIQUE INDEX `user_id_UNIQUE` ON `logs`.`log` (`user_id` ASC);

-- -----------------------------------------------------
-- Table `message`
-- -----------------------------------------------------

CREATE TABLE IF NOT EXISTS `logs`.`message` (
  `id` INTEGER NOT NULL,
  `session_id` INTEGER NULL,
  `request_id` BLOB(16) NULL,
  `is_response` TINYINT NULL,
  `message` TEXT NULL,
  `sent` DATETIME NULL,
  PRIMARY KEY (`id`),
  CONSTRAINT `fk_message_session1`
    FOREIGN KEY (`session_id`)
    REFERENCES `session` (`id`)
    ON DELETE NO ACTION
    ON UPDATE NO ACTION);;

-- CREATE UNIQUE INDEX `session_id_UNIQUE` ON `logs`.`message` (`session_id` ASC);

INSERT INTO `logs`.`log` SELECT *
FROM `main`.`log`;

INSERT INTO `logs`.`message` SELECT *
FROM `main`.`message`;


DROP TABLE IF EXISTS `log`;
DROP TABLE IF EXISTS `message`;


PRAGMA foreign_keys = ON;

