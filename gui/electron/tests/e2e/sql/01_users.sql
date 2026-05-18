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

CREATE USER IF NOT EXISTS 'shell'@'localhost' IDENTIFIED BY 'dummy';
CREATE USER IF NOT EXISTS 'shell'@'%' IDENTIFIED BY 'dummy';
GRANT ALL ON *.* TO 'shell'@'localhost' WITH GRANT OPTION;
GRANT ALL ON *.* TO 'shell'@'%' WITH GRANT OPTION;

CREATE USER IF NOT EXISTS 'clientqa'@'localhost' IDENTIFIED BY 'dummy';
CREATE USER IF NOT EXISTS 'clientqa'@'%' IDENTIFIED BY 'dummy';
GRANT ALL ON *.* TO 'clientqa'@'localhost' WITH GRANT OPTION;
GRANT ALL ON *.* TO 'clientqa'@'%' WITH GRANT OPTION;

CREATE USER IF NOT EXISTS 'dbuser1'@'localhost' IDENTIFIED BY 'dummy';
CREATE USER IF NOT EXISTS 'dbuser1'@'%' IDENTIFIED BY 'dummy';
GRANT ALL ON *.* TO 'dbuser1'@'localhost' WITH GRANT OPTION;
GRANT ALL ON *.* TO 'dbuser1'@'%' WITH GRANT OPTION;

CREATE USER IF NOT EXISTS 'dbuser2'@'localhost' IDENTIFIED BY 'dummy';
CREATE USER IF NOT EXISTS 'dbuser2'@'%' IDENTIFIED BY 'dummy';
GRANT ALL ON *.* TO 'dbuser2'@'localhost' WITH GRANT OPTION;
GRANT ALL ON *.* TO 'dbuser2'@'%' WITH GRANT OPTION;

CREATE USER IF NOT EXISTS 'dbuser3'@'localhost' IDENTIFIED BY 'dummy';
CREATE USER IF NOT EXISTS 'dbuser3'@'%' IDENTIFIED BY 'dummy';
GRANT ALL ON *.* TO 'dbuser3'@'localhost' WITH GRANT OPTION;
GRANT ALL ON *.* TO 'dbuser3'@'%' WITH GRANT OPTION;
