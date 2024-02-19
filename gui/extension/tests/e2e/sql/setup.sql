-- E2E Extension tests Database configurations
-- Copyright (c) 2023, 2024 Oracle and/or its affiliates.

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

-- All in tables
DROP TABLE IF EXISTS `all_in_table_1`; 
CREATE TABLE `all_in_table_1` (
  `id` int NOT NULL,
  `f_varchar` varchar(5) DEFAULT NULL,
  `f_decimal` decimal(5,0) DEFAULT NULL,
  `f_datetime` datetime DEFAULT NULL,
  `f_blob` blob,
  `f_binary` binary(5) DEFAULT NULL,
  `f_longblob` longblob,
  `f_medblob` mediumblob,
  `f_tinyblob` tinyblob,
  `f_varbinary` varbinary(5) DEFAULT NULL,
  PRIMARY KEY (`id`)
);
INSERT INTO `all_in_table_1` VALUES(1, 
'gui12', 
'4', 
'2023-01-01 00:00:01', 
0xa1b8de72d02badac81b9f7deac, 
0x6173646667, 
0xa1b8de72d02badac81b9f7deac, 
0xa1b8de72d02badac81b9f7deac, 
0xa1b8de72d02badac81b9f7deac, 
0x6173646667);

DROP TABLE IF EXISTS `all_in_table_2`; 
CREATE TABLE `all_in_table_2` (
  `f_date` date NOT NULL,
  `f_datetime` datetime(5) DEFAULT NULL,
  `f_time` time DEFAULT NULL,
  `f_timestamp` timestamp(5) NULL DEFAULT NULL,
  `f_year` year DEFAULT NULL,
  `f_geometry` geometry DEFAULT NULL,
  `f_geometry_collection` geomcollection DEFAULT NULL,
  `f_linestring` linestring DEFAULT NULL,
  `f_multilinestring` multilinestring DEFAULT NULL,
  `f_multipoint` multipoint DEFAULT NULL,
  `f_multipolygon` multipolygon DEFAULT NULL,
  `f_point` point DEFAULT NULL,
  `f_polygon` polygon DEFAULT NULL,
  PRIMARY KEY (`f_date`)
);

INSERT INTO `sakila`.`all_in_table_2`
(`f_date`,
`f_datetime`,
`f_time`,
`f_timestamp`,
`f_year`,
`f_geometry`,
`f_geometry_collection`,
`f_linestring`,
`f_multilinestring`,
`f_multipoint`,
`f_multipolygon`,
`f_point`,
`f_polygon`
)
VALUES
("2023-01-01",
"2023-01-01 00:02:00",
"00:02:00",
"2023-01-01 00:02:00",
"2023",
ST_GeomFromText('POINT(1 1)'),
ST_GeomFromText('GEOMETRYCOLLECTION(POINT(1 1),LINESTRING(0 0,1 1,2 2,3 3,4 
4))'),
ST_LineStringFromText('LINESTRING(0 0,1 1,2 2)'),
ST_GeomFromText('MultiLineString((1 1,2 2,3 3),(4 4,5 5))'),
ST_GeomFromText('MULTIPOINT(0 0, 20 20, 60 60)'),
ST_GeomFromText('MULTIPOLYGON(((0 0,10 0,10 10,0 10,0 0)),((5 5,7 5,7 7,5 7, 
5 5)))'),
ST_GeomFromText('POINT(1 1)'),
ST_GeomFromText('POLYGON((0 0,10 0,10 10,0 10,0 0),(5 5,7 5,7 7,5 7, 5 5))')
);

DROP TABLE IF EXISTS `all_in_table_3`; 
CREATE TABLE `all_in_table_3` (
  `id` int NOT NULL,
  `f_json` json DEFAULT NULL,
  `f_char` char(5) CHARACTER SET utf8mb3 COLLATE utf8mb3_general_ci DEFAULT NULL,
  `f_varchar` varchar(5) CHARACTER SET utf8mb3 COLLATE utf8mb3_general_ci DEFAULT NULL,
  `f_longtext` longtext,
  `f_mediumtext` mediumtext,
  `f_tinytext` tinytext,
  `f_bit` bit(5) DEFAULT NULL,
  `f_boolean` tinyint(1) DEFAULT NULL,
  `f_ENUM` enum('1','2') DEFAULT NULL,
  `f_set` set('5') DEFAULT NULL,
  PRIMARY KEY (`id`)
);

INSERT INTO `sakila`.`all_in_table_3` VALUES(
  0, '{"test": "1"}', 'char', 'var', 'long', 'medium', 'tiny', b'0', 1, '2', '5'
);