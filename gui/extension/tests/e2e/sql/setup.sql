-- E2E Extension tests Database configurations
-- Copyright (c) 2023, Oracle and/or its affiliates.

-- Redistribution and use in source and binary forms, with or without
-- modification, are permitted provided that the following conditions are
-- met:

-- * Redistributions of source code must retain the above copyright notice,
--   this list of conditions and the following disclaimer.
-- * Redistributions in binary form must reproduce the above copyright
--   notice, this list of conditions and the following disclaimer in the
--   documentation and/or other materials provided with the distribution.
-- * Neither the name of Oracle nor the names of its contributors may be used
--   to endorse or promote products derived from this software without
--   specific prior written permission.

-- THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS
-- IS" AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO,
-- THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR
-- PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT OWNER OR
-- CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL,
-- EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO,
-- PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR
-- PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF
-- LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING
-- NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS
-- SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.

SET GLOBAL local_infile = 'ON';
-- REST suite
USE sakila;
DROP SCHEMA IF EXISTS `mysql_rest_service_metadata`;
DROP TABLE IF EXISTS `abc`; 
CREATE TABLE `abc` (id int,name VARCHAR(50));
DROP SCHEMA IF EXISTS `dummyschema`; 
CREATE SCHEMA `dummyschema`;

-- DB suite
-- Dump Schema to Disk test
DROP SCHEMA IF EXISTS `dump_schema_to_disk`;
CREATE SCHEMA `dump_schema_to_disk`;

-- Load Dump from Disk test
DROP SCHEMA IF EXISTS `load_dump_from_disk`;

-- Dump Schema to Disk for MySQL Database Service test
DROP SCHEMA IF EXISTS `schema_for_mysql_db_service`;
CREATE SCHEMA `schema_for_mysql_db_service`;

-- Drop schema test
DROP SCHEMA IF EXISTS `schema_to_drop`;
CREATE SCHEMA `schema_to_drop`;

-- Drop Table test
DROP TABLE IF EXISTS `table_to_drop`; 
CREATE TABLE `table_to_drop` (id int,name VARCHAR(50));

-- Views
DROP VIEW IF EXISTS `test_view`; 
CREATE VIEW `test_view` as select * from actor;

DROP VIEW IF EXISTS `view_to_drop`; 
CREATE VIEW `view_to_drop` as select * from actor;

-- Event 
DROP EVENT IF EXISTS `test_event`;
CREATE EVENT test_event
    ON SCHEDULE AT CURRENT_TIMESTAMP + INTERVAL 1 HOUR
    DO
      select 1;

-- Routine
DROP PROCEDURE IF EXISTS `test_routine`;
DELIMITER $$ 
CREATE DEFINER=`root`@`localhost` 
PROCEDURE `test_routine`() 
BEGIN 
	select * from sakila.actor; 
END$$ 
DELIMITER ;
