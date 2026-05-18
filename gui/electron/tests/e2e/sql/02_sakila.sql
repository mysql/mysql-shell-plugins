-- Copyright (c) 2026, Oracle and/or its affiliates.
--
-- This program is free software; you can redistribute it and/or modify
-- it under the terms of the GNU General Public License, version 2.0,
-- as published by the Free Software Foundation.
--
-- This program is designed to work with certain software (including
-- but not limited to OpenSSL) that is licensed under separate terms, as
-- designated in a particular file or component or in included license
-- documentation.  The authors of MySQL hereby grant you an additional
-- permission to link the program and your derivative works with the
-- separately licensed software that they have either included with
-- the program or referenced in the documentation.
--
-- This program is distributed in the hope that it will be useful, but
-- WITHOUT ANY WARRANTY; without even the implied warranty of
-- MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See
-- the GNU General Public License, version 2.0, for more details.
--
-- You should have received a copy of the GNU General Public License
-- along with this program; if not, write to the Free Software Foundation, Inc.,
-- 51 Franklin St, Fifth Floor, Boston, MA 02110-1301 USA

CREATE DATABASE IF NOT EXISTS `sakila`;
USE `sakila`;

DROP TABLE IF EXISTS `film`;
DROP TABLE IF EXISTS `actor`;

CREATE TABLE `actor` (
  `actor_id` smallint unsigned NOT NULL AUTO_INCREMENT,
  `first_name` varchar(45) NOT NULL,
  `last_name` varchar(45) NOT NULL,
  `last_update` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`actor_id`),
  KEY `idx_actor_last_name` (`last_name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb3;

INSERT INTO `actor` (`actor_id`, `first_name`, `last_name`, `last_update`) VALUES
  (1, 'PENELOPE', 'GUINESS', '2006-02-15 04:34:33'),
  (2, 'NICK', 'WAHLBERG', '2006-02-15 04:34:33'),
  (3, 'ED', 'CHASE', '2006-02-15 04:34:33');

CREATE TABLE `film` (
  `film_id` smallint unsigned NOT NULL AUTO_INCREMENT,
  `title` varchar(128) NOT NULL,
  `description` text,
  `release_year` year DEFAULT NULL,
  `last_update` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`film_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb3;

INSERT INTO `film` (`film_id`, `title`, `description`, `release_year`, `last_update`) VALUES
  (1, 'ACADEMY DINOSAUR', 'A dinosaur documentary', 2006, '2006-02-15 05:03:42'),
  (2, 'ACE GOLDFINGER', 'A database test fixture film', 2006, '2006-02-15 05:03:42');
